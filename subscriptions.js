// 
// Subscriptions glue plugins to events
// flowing through the Gekko.
// 

var subscriptions = [
  {
    emitter: 'market',
    event: 'candle',
    handler: 'processCandle'
  },
  {
    emitter: 'market',
    event: 'history',
    handler: 'processHistory'
  },
  {
    emitter: 'tradingAdvisor',
    event: 'advice',
    handler: 'processAdvice'
  },
  {
    emitter: ['trader', 'paperTrader', 'multiTrader', 'multiPaperTrader'],
    event: 'trade',
    handler: 'processTrade'
  },
  {
    emitter: ['trader', 'paperTrader', 'multiTrader', 'multiPaperTrader'],
    event: 'portfolioUpdate',
    handler: 'processPortfolioUpdate'
  },
];

module.exports = subscriptions;