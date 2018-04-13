var fs = require('fs');
var https = require('https');
var Poloniex = require("poloniex.js");

// TODO: configure key in config file
var key = 'your key';
var secret = 'your secret';

var poloniex = new Poloniex(key, secret);

fs.readFile('mulitTradeAssets.txt', 'utf8', function (err, data) {
  if (err) {
    console.log(err);
    return;
  }

  var msg = '\n';
  var assets = data.replace('\n', ',').split(',');
  if (!assets[assets.length - 1]) {
    assets = assets.splice(0, assets.length - 1);
  }

  var sendIfttt = function (msg) {
    var json = "{ \"value1\": \"" + msg.replace(/\n/g, '\\n') + "\" }";

    var options = {
      hostname: 'maker.ifttt.com',
      port: 443,
      path: '/trigger/gekko_trade/with/key/crGyrAaBfn-9QlmvVvDx_w',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    };

    var req = https.request(options, function (res) {
      // console.log('Status: ' + res.statusCode);
      // console.log('Headers: ' + JSON.stringify(res.headers));
      res.setEncoding('utf8');
      res.on('data', function (body) {
        // console.log('Body: ' + body);
      });
    });
    req.on('error', function (e) {
      console.log('problem with request: ' + e.message);
    });
    // write data to request body
    req.write(json);
    req.end();
  };

  var set = function (err, data) {
    if (err) {
      console.log(err);
      return;
    }
    if (data['USDT'] !== undefined) {
      let usdts = parseFloat(data['USDT']);
      var now = Math.floor(new Date() / 1000);

      var i = 0;
      var getBalance = function () {
        var asset = assets[i];

        msg += asset + ':  ' + data[asset] + '\n';

        // poloniex.myOpenOrders('USDT', asset, function (err, response) {
        // 	if (response.length) {
        // 		console.log(asset, response);
        // 	}
        // });

        poloniex.getTradeHistory('USDT', asset, 300, now - 3600, now, function (err, response) {
          usdts += parseFloat(data[asset]) * response[response.length - 1].close;
          i++;
          if (i != assets.length) {
            getBalance();
          } else {
            msg += 'total USDT: ' + usdts + '\n';
            //console.log(msg);
            sendIfttt(msg);
          }
        });
      };

      getBalance();
    } else {
      console.log('error loading currencies');
    }
  }

  poloniex.myBalances(set);
});
