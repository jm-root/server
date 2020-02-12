module.exports = {
  disableClustering: true, // for cluster mode, https://log4js-node.github.io/log4js-node/clustering.html
  appenders: {
    console: { type: 'console' },
    server: {
      type: 'dateFile',
      filename: 'logs/server',
      pattern: 'yyyyMMdd.log',
      alwaysIncludePattern: true
    }
  },
  categories: {
    default: { appenders: [ 'console' ], level: 'info' },
    server: { appenders: [ 'console', 'server' ], level: 'info' }
  }
}
