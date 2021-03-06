const ms = require('../ms')

module.exports = function (app) {
  let router = ms.router()
  router.add('/', 'get', function (opts) {
    return app.moduleConfigs
  })
  router.add('/:name', 'delete', function (opts) {
    app.unuse(opts.params.name)
    return { ret: true }
  })
  app.router.use('/modules', router)
}
