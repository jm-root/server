const { EventEmitter } = require('jm-event')
const RouterLoader = require('./routerLoader')

class Service extends EventEmitter {
  constructor () {
    super({ async: true })
    this.ready = false
    this.onReady()
  }

  async onReady () {
    if (this.ready) return
    return new Promise(resolve => {
      this.once('ready', () => {
        this.ready = true
        resolve()
      })
    })
  }

  /**
   * load router from dir
   * @param dir
   * @param opts
   *  nohelp: 是否支持 get /
   * @returns {*}
   */
  loadRouter (dir, opts) {
    return new RouterLoader(this, { dir, ...opts }).router
  }
}

module.exports = Service
