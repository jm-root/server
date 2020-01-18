require('log4js').configure(require('./log4js'))
process.env.NODE_CONFIG_DIR = __dirname
const config = require('config')
module.exports = config
