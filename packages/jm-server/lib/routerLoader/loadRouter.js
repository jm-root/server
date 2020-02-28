const path = require('path')
const fs = require('fs')
const log = require('jm-log4js')

const logger = log.getLogger('server')
const ms = require('../ms')

function loadRouterFile (service, dir, file) {
  const key = path.basename(file, '.js')
  let prefix = `/${key}`
  key === 'index' && (prefix = '/')
  if (!fs.existsSync(`${dir}/${file}`) || !fs.statSync(`${dir}/${file}`).isFile()) return
  const router = require(`${dir}/${key}`)(service)
  router.prefix || (router.prefix = prefix)
  logger.debug(`load router ${prefix}`)
  return router
}

function loadRouter (service, dir) {
  const router = ms.router()

  // 先处理 index.js
  const r = loadRouterFile(service, dir, 'index.js')
  r && (router.use(r.prefix, r))

  fs
    .readdirSync(dir)
    .filter(function (file) {
      return (file.indexOf('.js') !== 0) && (file !== 'index.js')
    })
    .forEach(file => {
      if (fs.statSync(`${dir}/${file}`).isDirectory()) {
        const prefix = `/${file}`
        logger.debug(`load router dir ${prefix} ...`)
        router.use(prefix, loadRouter(service, `${dir}/${file}`))
        logger.debug(`load router dir ${prefix} ...ok`)
        return
      }
      const r = loadRouterFile(service, dir, file)
      r && (router.use(r.prefix, r))
    })
  return router
}

module.exports = loadRouter
