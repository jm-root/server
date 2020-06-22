const ms = require('../ms')

function controller (uri) {
  if (typeof uri === 'function') return controller().apply(this, arguments)
  return function (target) {
    const { prototype } = target
    prototype.router = function () {
      const router = ms.router()
      router.use({
        uri,
        fn: this._router
      })
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
  return function (target, name, descriptor) {
    getRouter(target).use({
      uri,
      type,
      fn: target[name].bind(target)
    })
    return descriptor
  }
}

function add (uri, type) {
  if (typeof uri === 'object') return add().apply(this, arguments)
  return function (target, name, descriptor) {
    getRouter(target).add({
      uri,
      type,
      fn: target[name].bind(target)
    })
    return descriptor
  }
}

function addType (type) {
  return function (uri) {
    if (typeof uri === 'object') return addType(type)().apply(this, arguments)
    return function (target, name, descriptor) {
      getRouter(target).add({
        uri,
        type,
        fn: target[name].bind(target)
      })
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
  delete: addType('delete')
}
