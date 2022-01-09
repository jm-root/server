#!/usr/bin/env node

'use strict'
const fs = require('fs')
const path = require('path')
const argv = require('yargs')
  .alias('c', 'config')
  .alias('p', 'port')
  .alias('a', 'host')
  .alias('f', 'prefix')
  .alias('d', 'debug')
  .alias('t', 'trust_proxy')
  .alias('l', 'lng')
  .alias('D', 'daemon')
  .argv

const { Server } = require('../lib')

let root = argv._[0]
if (root && !path.isAbsolute(root)) {
  root = path.join(process.cwd(), root)
}
root || (root = process.cwd())

let config = null
configure()
module.exports = startApp()

function configure () {
  let configFile = argv.c
  if (configFile && !path.isAbsolute(configFile)) {
    configFile = path.join(root, configFile)
  }
  configFile || (configFile = path.join(root, '/config'))

  if (argv.production) process.env.NODE_ENV = 'production'
  try {
    fs.accessSync(configFile, fs.constants.R_OK)
    config = require(configFile)
  } catch (e) {
    console.warn('no config file found %s'.red, configFile)
    console.error(e.stack)
  }
  config || (config = {});
  ['host', 'port', 'debug', 'prefix', 'trust_proxy', 'lng', 'max_body_size'].forEach(function (key) {
    argv[key] && (config[key] = argv[key])
  })
}

function startApp () {
  return new Server(config)
}

function stopApp () {
  console.log('jm-server stopped.'.red)
  process.exit()
}

process.on('SIGINT', function () {
  stopApp()
})

process.on('SIGTERM', function () {
  stopApp()
})

process.on('uncaughtException', function (err) {
  console.error('Caught exception: ' + err.stack)
})
