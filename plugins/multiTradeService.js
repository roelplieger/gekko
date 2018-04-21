var mongojs = require('mongojs');
var fs = require('fs');

/**
 * asset object:
 *
 * {
 *      assetId: 'XXX',
 *      amount: 999       // the amount of USDT's used to by this asset, needs to be zero to be able to buy
 * }
 */
var MultiTraderService = function (startBalance) {
  var assets = [];

  var init = function () {
    var promise = new Promise(function (resolve, reject) {
      fs.readFile('mulitTradeAssets.txt', 'utf8', function (err, data) {
        if (err) {
          reject(err);
          return;
        }
        assets = data.replace('\n', ',').split(',');
        // if last entry is empty remove it
        if (assets[assets.length - 1] == '') {
          assets.pop();
        }
        // if there is no balance yet create it with amount = startBalance
        var db = getDB();
        db.balance.findOne({
          currency: 'USDT'
        }, function (err, data) {
          if (err) {
            log(db, 'error initializing: ' + err);
            reject(err);
          } else {
            if (!data) {
              db.balance.insert({
                currency: 'USDT',
                balance: startBalance
              });
              log(db, 'initial balance created: ' + startBalance);
            } else {
              log(db, 'initial balance: ' + data.balance);
            }
            resolve();
          }
          db.close();
        });
      });
    });
    return promise;
  }

  // don't need this log anymore
  var log = function (db, action, assetId, amount) {
    // db.log.insert({
    //   timeStamp: new Date(),
    //   action: action,
    //   currency: 'USDT',
    //   assetId: assetId,
    //   amount: amount
    // });
  }

  var logTrade = function (action, assetId, amount, price) {
    var db = getDB();
    db.tradeLog.insert({
      timeStamp: new Date(),
      action: action,
      assetId: assetId,
      amount: amount,
      price: price,
      total: amount * price
    });
    db.close();
  }

  var getDB = function () {
    var db = mongojs('multitrade');
    db.on('error', function (err) {
      console.log('multitrade database error')
    });
    return db;
  }

  /**
   * Check if asset is currently configured in assets
   */
  var isAssetInUse = function (assetId) {
    for (var i in assets) {
      if (assets[i] == assetId) {
        return true;
      }
    }
    return false;
  }

  /**
   * Get the balance available for an asset; setPortfolio updates the current portfolio after the lock is set.
   */
  var getBalance = function (db, assetId, setPortfolio) {
    var promise = new Promise(function (resolve, reject) {
      var retries = 5;

      var isLockExpired = function (lockTime) {
        var now = new Date().getTime();
        return (now - lockTime) > 3000; // max 3 seconds
      }

      var getLockedBalance = function () {
        if (retries) {
          db.balance.findOne({
            currency: 'USDT'
          }, function (err, data) {
            if (err) {
              retries = 0;
            } else {
              // if balance is locked try again after 50 ms
              if (data.assetLock && !isLockExpired(data.lockTime)) {
                retries--;
                setTimeout(getLockedBalance, 50);
              } else {
                // set the lock and check if it succeeded
                db.balance.findAndModify({
                  query: {
                    currency: 'USDT'
                  },
                  update: {
                    $set: {
                      assetLock: assetId,
                      lockTime: new Date().getTime()
                    }
                  },
                  new: true
                }, function (err, data) {
                  if (err) {
                    retries = 0;
                  } else {
                    // reread the record and check if we own the lock
                    db.balance.findOne({
                      currency: 'USDT'
                    }, function (err, data) {
                      if (err) {
                        retries = 0;
                      } else {
                        if (data.assetLock == assetId) {
                          retries = 0;
                          setPortfolio(function (portfolio) {
                            // portfolio is an array with two objects, first has currency balance
                            resolve(portfolio[0].amount);
                          });
                        } else {
                          // another asset locked the balance
                          retries--;
                          setTimeout(getLockedBalance, 50);
                        }
                      }
                    });
                  }
                });
              }
            }
          });
        } else {
          reject('cannot lock balance');
        }
      }

      getLockedBalance();
    });
    return promise;
  }

  /**
   * Release the lock. This will only be called after a succesful lock so we can just clear it
   */
  var unlockBalance = function (db) {
    db.balance.update({
      currency: 'USDT'
    }, {
      $set: {
        assetLock: undefined
      }
    });
  }

  /**
   * Get the maximum amount of currency to buy an asset
   */
  var withdraw = function (assetId, setPortfolio) {
    let self = this;

    var promise = new Promise(function (resolve, reject) {
      if (!isAssetInUse(assetId)) {
        reject('asset ' + assetId + ' not configured, cannot withdraw');
      } else {
        var db = getDB();
        // first get the current balance and lock it
        getBalance(db, assetId, setPortfolio).then(function (balance) {
          // get all assets
          db.assets.find(function (err, data) {
            if (err) {
              reject(err);
            } else {
              // data is an array of asset objects
              var zeroAssets = assets.length;
              // count number of assets with amount = 0, if desired asset has amount != 0 reject
              for (var i in data) {
                var asset = data[i];
                if (asset.assetId == assetId && asset.amount != 0) {
                  // release the lock
                  unlockBalance(db);
                  db.close();
                  reject('already bought ' + asset.amount + ' of ' + assetId);
                  return;
                }
                if (isAssetInUse(asset.assetId) && asset.amount != 0) {
                  zeroAssets--;
                }
              }
              // the amount we can withdraw is balance / zeroAssets
              withdrawAmount = (balance / zeroAssets);
              // update the amount of the asset and the balance
              db.assets.findAndModify({
                query: {
                  assetId: assetId
                },
                update: {
                  $set: {
                    amount: withdrawAmount
                  }
                },
                upsert: true,
                new: true
              }, function (err, data) {
                db.balance.update({
                  currency: 'USDT'
                }, {
                  $inc: {
                    balance: -withdrawAmount
                  }
                });
                // release the lock
                unlockBalance(db);
                log(db, 'withdraw', assetId, withdrawAmount);
                db.close();
                resolve(withdrawAmount);
              });
            }
          });
        }, function (err) {
          reject(err);
        })
      }
    });
    return promise;
  }

  /**
   * Deposit an asset, set the asset's amount to zero
   */
  var deposit = function (assetId, setPortfolio) {
    let self = this;

    var promise = new Promise(function (resolve, reject) {
      if (!isAssetInUse(assetId)) {
        reject('asset ' + assetId + ' not configured, cannot deposit');
      } else {
        // update total balance and reset amount of asset to zero
        var db = getDB();
        // lock the balance before updating
        getBalance(db, assetId, setPortfolio).then(function (balance) {
          db.balance.update({
            currency: 'USDT'
          }, {
            $set: {
              balance: balance
            }
          });
          db.assets.update({
            assetId: assetId
          }, {
            $set: {
              amount: 0.0
            }
          });
          // release the lock
          unlockBalance(db);
          log(db, 'deposit', assetId, balance);
          db.close();
          resolve(balance);
        }, function (err) {
          db.close();
          reject(err);
        });
      }
    });
    return promise;
  }

  return {
    init: init,
    withdraw: withdraw,
    deposit: deposit,
    logTrade: logTrade
  }
}
/*
var service = new MultiTraderService(1000.0);
service.init().then(function () {
    service.deposit('BTC', 742).then(function (balance) {
        console.log('new balance: ' + balance);
    }, function (err) {
        console.log(err);
    });
    // service.withdraw('BTC').then(function (balance) {
    //     console.log('balance available: ' + balance);
    // }, function (err) {
    //     console.log(err);
    // });
}, function (err) {
    console.log(err);
});
*/
module.exports = MultiTraderService;
