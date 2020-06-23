const ms = require('../ms')
const { utils: { uniteParams } } = require('jm-ms-core')

function controller (uri) {
  if (typeof uri === 'function') return controller().apply(this, arguments)
  const opts = uniteParams(...arguments)
  return function (target) {
    const { prototype } = target
    const fn = prototype.router // 如果存在旧的router函数, 在后面调用
    prototype.router = function () {
      const router = ms.router()
      router.use({
        ...opts,
        fn: this._router
      })
      if (fn) {
        router.use({
          ...opts,
          fn: fn.apply(this)
        })
      }
      return router
    }
  }
}

function getRouter (target) {
  target._router || (target._router = ms.router())
  return target._router
}

function use (uri, type) {
  if (typeof uri === 'object') return use().apply(this, arguments)
  const opts = uniteParams(...arguments)
  return function (target, name, descriptor) {
    const router = getRouter(target)
    opts.fn && (router.use(opts))
    router.use({ ...opts, fn: target[name].bind(target) })
    return descriptor
  }
}

function add (uri, type) {
  if (typeof uri === 'object') return add().apply(this, arguments)
  const opts = uniteParams(...arguments)
  return function (target, name, descriptor) {
    const router = getRouter(target)
    opts.fn && (router.add(opts))
    router.add({ ...opts, fn: target[name].bind(target) })
    return descriptor
  }
}

function addType (type) {
  return function (uri) {
    if (typeof uri === 'object') return addType(type)().apply(this, arguments)
    const opts = uniteParams(...arguments)
    opts.type = type
    return function (target, name, descriptor) {
      if (opts.fn) getRouter(target).add(opts)
      opts.fn = target[name].bind(target)
      getRouter(target).add(opts)
      return descriptor
    }
  }
}

module.exports = {
  controller,
  use,
  add,
  get: addType('get'),
  post: addType('post'),
  put: addType('put'),
  del: addType('delete')
}
