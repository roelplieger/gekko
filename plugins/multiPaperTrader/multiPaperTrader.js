const _ = require('lodash');

const util = require('../../core/util');
const ENV = util.gekkoEnv();

const config = util.getConfig();
const calcConfig = config.multiPaperTrader;
const watchConfig = config.watch;

const MultiTradeService = require('../multiTradeService');

const MultiPaperTrader = function () {
  _.bindAll(this);

  this.fee = 1 - (calcConfig['fee' + calcConfig.feeUsing.charAt(0).toUpperCase() + calcConfig.feeUsing.slice(1)] + calcConfig.slippage) / 100;

  this.currency = watchConfig.currency;
  this.asset = watchConfig.asset;

  this.portfolio = {
    asset: calcConfig.simulationBalance.asset,
    currency: calcConfig.simulationBalance.currency,
    balance: calcConfig.simulationBalance.currency
  }

  this.multiTradeService = new MultiTradeService(this.portfolio.currency);
  this.multiTradeService.init().then(function () {
    console.log('MultiTradeService intialized');
  });
}

// teach our paper trader events
util.makeEventEmitter(MultiPaperTrader);

MultiPaperTrader.prototype.relayTrade = function (advice) {
  var what = advice.recommendation;
  var price = advice.candle.close;
  var at = advice.candle.start;

  let action;
  if (what === 'short')
    action = 'sell';
  else if (what === 'long')
    action = 'buy';
  else
    return;

  this.emit('trade', {
    action,
    price,
    portfolio: _.clone(this.portfolio),
    balance: this.portfolio.currency + this.price * this.portfolio.asset,
    date: at
  });
}

MultiPaperTrader.prototype.relayPortfolio = function () {
  this.emit('portfolioUpdate', _.clone(this.portfolio));
}

MultiPaperTrader.prototype.extractFee = function (amount) {
  amount *= 1e8;
  amount *= this.fee;
  amount = Math.floor(amount);
  amount /= 1e8;
  return amount;
}

// MultiPaperTrader.prototype.setStartBalance = function () {
//   this.portfolio.balance = this.portfolio.currency + this.price * this.portfolio.asset;
//   this.relayPortfolio();
// }

// after every succesfull trend ride we hopefully end up
// with more BTC than we started with, this function
// calculates Gekko's profit in %.
MultiPaperTrader.prototype.updatePosition = function (advice) {

  let self = this;

  let setPortfolio = function (callback) {
    callback([
      { name: self.asset, amount: self.portfolio.asset },
      { name: self.currency, amount: self.portfolio.currency }
    ]);
  }

  let promise = new Promise(function (resolve, reject) {
    let what = advice.recommendation;
    let price = advice.candle.close;

    // virtually trade all {currency} to {asset}
    // at the current price (minus fees)
    if (what === 'long') {
      self.multiTradeService.withdraw(self.asset, setPortfolio).then(function (balance) {
        self.portfolio.asset += self.extractFee(self.portfolio.currency / price);
        self.portfolio.currency = 0;
        self.trades++;
        resolve();
      }, function (err) {
        reject(err);
      });
    }
    // virtually trade all {asset} to {currency}
    // at the current price (minus fees)
    else if (what === 'short') {
      let deposit = self.extractFee(self.portfolio.asset * price);
      self.multiTradeService.deposit(self.asset, setPortfolio).then(function () {
        self.portfolio.currency += deposit;
        self.portfolio.asset = 0;
        self.trades++;
      }, function (err) {
        reject(err);
      });
    }
  });
  return promise;
}

MultiPaperTrader.prototype.processAdvice = function (advice) {
  if (advice.recommendation === 'soft')
    return;

  var self = this;

  self.updatePosition(advice).then(function () {
    self.relayTrade(advice);
  }, function (err) {
    console.log(err);
  });
}

MultiPaperTrader.prototype.processCandle = function (candle, done) {
  this.price = candle.close;

  // if (!this.portfolio.balance)
  //   this.setStartBalance();

  done();
}

module.exports = MultiPaperTrader;
