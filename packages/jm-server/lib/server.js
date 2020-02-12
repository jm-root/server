const log = require('jm-log4js')
const MS = require('jm-ms')
const http = require('http')
const express = require('express')

const logger = log.getLogger('server')
const ms = new MS()

module.exports = function (app) {
  let appWeb = null
  let server = null

  /**
   * 启动服务器
   * @method server#start
   * 成功响应:
   * doc: 结果true成功 false失败
   * 错误响应:
   * doc: {
     *  err: 错误码,
     *  msg: 错误信息
     * }
   */
  app.open = async function (opts = {}) {
    this.emit('beforeOpen', opts)
    const self = this
    const { config, root, servers } = this
    root.config = config

    // 启动web模块
    appWeb = express()
    const { debug, lng, host = '0.0.0.0', port = 3000, max_body_size: maxBodySize, trust_proxy: trustProxy = false } = config
    server = http.createServer(appWeb).listen(port, host, function () {
      logger.info('ms server listening on %s:%s ', host, server.address().port)
    })
    if (maxBodySize) {
      appWeb.use(express.json({ limit: maxBodySize }))
      appWeb.use(express.urlencoded({ limit: maxBodySize, extended: true }))
    } else {
      appWeb.use(express.json())
      appWeb.use(express.urlencoded({ extended: true }))
    }

    appWeb.set('trust proxy', trustProxy) // 支持代理后面获取用户真实ip

    // 设置跨域访问
    appWeb.use(function (req, res, next) {
      res.header('Access-Control-Allow-Origin', '*')
      res.header('Access-Control-Allow-Headers', 'X-Forwarded-For, X-Requested-With, Content-Type, Content-Length, Authorization, Accept')
      res.header('Access-Control-Allow-Methods', 'PUT, POST, GET, DELETE, OPTIONS, HEAD')
      res.header('Content-Type', 'application/json;charset=utf-8')
      if (req.method === 'OPTIONS' || req.method === 'HEAD') {
        res.status(200).end()
      } else if (req.url.indexOf('/favicon.ico') >= 0) {
        res.status(404).end()
      } else {
        next()
      }
    })

    // 启动ms服务器
    const { ms: configMS = [
      { type: 'ws' },
      { type: 'http' }
    ] } = config

    for (const i in configMS) {
      const opts = configMS[i]
      opts.server = server
      opts.app = appWeb
      const doc = await ms.server(root, opts)
      logger.info('ms server type:%s started', opts.type)
      servers[opts.type] = doc
      doc.on('connection', function (session) {
        self.emit('connection', session)
      })
    }

    const router = express.Router()
    servers.http.middle = router
    if (debug) {
      router.use(function (req, res, next) {
        // const {method, url, params, query, body, headers} = req
        // logger.debug('%s %s params: %j query: %j body: %j headers: %j', method, url, params, query, body, headers)
        const { method, url } = req
        logger.debug(`${method} ${url}`)
        next()
      })
    }
    if (lng) {
      router.use(function (req, res, next) {
        req.lng = lng
        next()
      })
    }

    router.use(this.httpProxyRouter)

    this.emit('open', opts)
    return true
  }

  /**
   * 停止服务器
   * @method server#stop
   * 成功响应:
   * doc: 结果true成功 false失败
   * 错误响应:
   * doc: {
     *  err: 错误码,
     *  msg: 错误信息
     * }
   */
  app.close = async function (opts) {
    this.emit('beforeClose', opts)
    if (server) {
      server.close()
      server = null
      appWeb = null
    }
    this.emit('close', opts)
    return true
  }
}
