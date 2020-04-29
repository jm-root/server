const initTracer = require('jaeger-client').initTracer
const log = require('jm-log4js')
const logger = log.getLogger('server-jaeger')

module.exports = function (opts = {}) {
  const app = this || {}

  let { service_name: serviceName, jaeger, debug } = opts
  debug && (logger.setLevel('debug'))

  serviceName || (serviceName = opts.serviceName)
  if (!serviceName) return logger.warn('no service_name found. so I can not work.')
  if (!jaeger) return logger.warn('no jaeger found. so I can not work.')

  app
    .on('open', async () => {
      const config = {
        serviceName,
        sampler: {
          type: 'const',
          param: 1
        },
        reporter: {
          collectorEndpoint: jaeger
        }
      }

      const tracer = initTracer(config)

      const _extract = tracer.extract.bind(tracer)

      tracer.extract = function (format, carrier) {
        const parent = _extract(format, carrier)
        if (!parent.traceId) return null
        return parent
      }

      class $Tracer extends require('jm-server-opentracing') {
        _logSpan (msg, span) {
          if (!this.debug) return
          const { operationName } = span
          const { traceIdStr: traceId, spanIdStr: spanId, parentIdStr: parentId } = span.context()
          const info = { operationName, traceId, spanId, parentId }
          logger.debug(msg, JSON.stringify(info))
        }
      }

      new $Tracer({  // eslint-disable-line
        app,
        tracer,
        name: 'jaeger',
        debug
      })
    })
}
