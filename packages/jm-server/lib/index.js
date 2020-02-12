const proxy = require('http-proxy-middleware')
const express = require('express')
const { EventEmitter } = require('jm-event')
const error = require('jm-err')
const log = require('jm-log4js')
const MS = require('jm-ms')
const { arg2bool, arg2number } = require('jm-utils')
const routerHelp = require('./router/help')
const routerModule = require('./router/module')

const ms = new MS()
const logger = log.getLogger('server')

function validateConfig (opts) {
  let v = ['debug', 'trust_proxy', 'no_auto_init', 'no_auto_open']
  v.forEach(function (key) {
    const value = opts[key]
    value !== undefined && (opts[key] = arg2bool(value))
  })

  v = ['port']
  v.forEach(function (key) {
    const value = opts[key]
    value !== undefined && (opts[key] = arg2number(value))
  })
}

class App extends EventEmitter {
  constructor (opts) {
    super({ async: true })

    const v = ['host', 'port', 'debug', 'prefix', 'trust_proxy', 'lng', 'no_auto_init', 'no_auto_open', 'max_body_size']
    v.forEach(function (key) {
      process.env[key] && (opts[key] = process.env[key])
    })

    validateConfig(opts) // 检查配置信息

    const { debug } = opts
    debug && (logger.setLevel('debug'))

    if (debug) {
      logger.debug('config: %s', JSON.stringify(opts, null, 2))
    }

    Object.assign(this, {
      config: opts,
      debug
    })

    require('./server')(this)
    if (!opts.no_auto_init) this.init()
    if (!opts.no_auto_open) this.open()
  }

  clear () {
    this.root = ms.router()
    this.router = ms.router()
    this.httpProxyRouter = express.Router()
    this.moduleConfigs = {}
    this.modules = {}
    this.routers = {}
    this.servers = {}
  }

  init () {
    const { lng, prefix = '', trust_proxy: trustProxy = false, modules } = this.config || {}
    this.clear()
    this.emit('init')
    if (lng) {
      this.root.use(prefix, opts => {
        opts.lng = lng
      })
    }
    if (!trustProxy) {
      this.root.use(({ headers }) => {
        if (headers && headers['x-forwarded-for']) {
          delete headers['x-forwarded-for']
        }
      })
    }
    routerHelp(this)
    if (modules) this.uses(modules)
    this.emit('uses', this)
    this.root
      .use(prefix, this.router)

    routerModule(this)

    this.root
      .use(({ lng } = {}) => {
        const { Err: { t, FA_NOTFOUND } } = error
        const doc = Object.assign({}, FA_NOTFOUND, { msg: t(FA_NOTFOUND.msg, lng) || FA_NOTFOUND.msg })
        throw error.err(doc)
      })
    return true
  }

  // 加载httpProxy模块
  loadHttpProxyModule (opts = {}) {
    const { name, httpProxy: target, changeOrigin = true } = opts
    const { prefix = `/${name}` } = opts
    const options = {
      target,
      changeOrigin, // needed for virtual hosted sites
      onProxyReq: function (proxyReq, req, res) {},
      onProxyRes: function (proxyRes, req, res) {}
    }
    const router = express.Router()
    router.use(proxy(prefix, options))
    const module = router
    return {
      module,
      router
    }
  }

  // 加载proxy模块
  loadProxyModule ({ proxy }) {
    const router = ms.router()
    router.proxy('/', proxy)
    const module = router
    return {
      module,
      router
    }
  }

  // 加载模块
  loadModule (opts) {
    const { name, config, noRouter = false } = opts
    const { module: moduleName = name } = opts
    if (!moduleName && !opts.require) {
      logger.warn('use failed. %s: %j', name, opts)
      return
    }
    const Module = require(moduleName)
    const { version } = require(`${moduleName}/package.json`)
    const moduleInfo = { version }
    let module
    if (typeof Module === 'function') {
      module = Module.call(this, Object.assign({}, this.config, config), this)
    } else {
      module = Module
    }

    let router
    if (module) {
      if (module.request || module.execute) {
        router = module
      } else if (module.router && !noRouter) {
        router = module.router()
      }
    }

    return { module, router, moduleInfo }
  }

  /**
   * 添加模块
   * 支持多种参数格式, 例如
   * use(name, {module:module})
   * use(name, module)
   * @function server#use
   * @param {String} name 模块名称
   * @param {Object} opts 参数
   * @example
   * opts参数:
   * 'jm-config'
   * 或者对象
   * {
     *  module: jm-config(必填)
     * }
   * 或者代理
   * {
     *  proxy: uri(必填)
     * }
   * @returns {Object}
   */
  use (name = '', opts = {}) {
    if (typeof opts === 'string') {
      opts = { module: opts }
    }

    if (opts.require) {
      let v = opts.require
      if (typeof v === 'string') v = [v]
      for (let k in v) {
        require(v[k])
      }
    }

    let doc = null

    if (opts.httpProxy) {
      doc = this.loadHttpProxyModule({
        name,
        ...opts
      })
      if (doc) {
        this.httpProxyRouter.use(doc.router)
      }
    } else {
      if (opts.proxy) {
        doc = this.loadProxyModule(opts)
      } else {
        doc = this.loadModule({ name, ...opts })
      }

      if (doc && doc.router) {
        let { prefix = `/${name}` } = opts
        this.router.use(prefix, doc.router)
      }
    }

    if (doc) {
      const { module, router, moduleInfo } = doc
      this.moduleConfigs[name] = { ...opts, ...moduleInfo }
      this.modules[name] = module
      this.routers[name] = router
      logger.info('use ok. %s: %j', name, opts)
    }
    return this
  }

  /**
   * 添加多个模块
   * @function server#uses
   * @param {Object} opts 参数
   * @example
   * opts参数:{
     *  : {module: 'jm-ms-message'},
     *  config: jm-config,
     *  config1: jm-config1
     * }
   * @returns {Object}
   */
  uses (opts) {
    for (const name in opts) {
      this.use(name, opts[name])
    }
    return this
  }

  unuse (name) {
    const r = this.routers[name]
    delete this.modules[name]
    delete this.routers[name]
    if (r) r.clear()
  }
}

module.exports = {
  Server: App,
  Service: require('./service'),
  RouterLoader: require('./routerLoader')
}
