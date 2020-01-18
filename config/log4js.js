module.exports = {
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
