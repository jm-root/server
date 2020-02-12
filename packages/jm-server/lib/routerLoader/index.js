const fs = require('fs')
const error = require('jm-err')
const MS = require('jm-ms-core')
const wrapper = require('jm-ms-wrapper')
const loadRouter = require('./loadRouter')

const ms = new MS()

class Router {
  constructor (service, { dir, nohelp }) {
    const router = ms.router()
    this.router = router
    service.rootRouter = router

    wrapper(service.t)(router)

    // help
    if (!nohelp) {
      let pkg = null
      let pkgFile = require('path').join(dir, '../../package.json')
      try {
        fs.accessSync(pkgFile, fs.constants.R_OK)
        pkg = require(pkgFile)
      } catch (e) {
      }
      if (pkg) {
        router.add('/', 'get', opts => {
          opts.help || (opts.help = {})
          const { help } = opts
          help.status = 1
          if (!service.ready) help.status = 0
        })
        require('jm-ms-help').enableHelp(router, pkg)
      }
    }

    router
      .use(() => {
        const { ready } = service
        if (ready !== undefined && !ready) throw error.err(error.Err.FA_NOTREADY)
      })
      .use(loadRouter(service, dir))
  }
}

Router.loadRouter = loadRouter

module.exports = Router
