#!/usr/bin/env node

'use strict'
const cluster = require('cluster')
if (cluster.isMaster) {
  let numCPUs = require('os').cpus().length;
  ['maxcpus'].forEach(function (key) {
    process.env[key] && (numCPUs = parseInt(process.env[key]))
  })
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork()
  }

  const eachWorker = function (cb) {
    for (const id in cluster.workers) {
      cb(cluster.workers[id])
    }
  }

  cluster.on('fork', function (worker) {
    worker.on('message', function (msg) {
      eachWorker(function (doc) {
        doc.send(msg)
      })
    })
  })

  cluster.on('online', function (worker) {
  })

  cluster.on('listening', function (worker, address) {
  })

  cluster.on('disconnect', function (worker) {
  })

  cluster.on('exit', function (worker, code, signal) {
  })
} else if (cluster.isWorker) {
  require('./app')
}
