const { FORMAT_HTTP_HEADERS } = require('opentracing')
const cls = require('cls-hooked')
const log = require('jm-log4js')
const axios = require('axios')
const logger = log.getLogger('server-opentracing')

const NS_SPAN_EXPRESS = 'span_express'
const NS_SPAN_AXIOS = 'span_axios'
const NS_RESPONSE_EXPRESS = 'response_express'

module.exports = class {
  constructor ({ app, tracer, name, debug }) {
    Object.assign(this, { app, tracer, name, debug })
    debug && (logger.setLevel('debug'))
    const namespace = cls.createNamespace(name)

    const _logSpan = this._logSpan.bind(this)

    async function filterTracer (req, res, next) {
      namespace.run(() => {
        const { headers, headers: { trace } = {} } = req
        let parent = null
        try {
          parent = tracer.extract(FORMAT_HTTP_HEADERS, headers)
        } catch (e) { console.error(e) }
        if (!trace && !parent) return next()

        const old = res.json.bind(res)
        res.json = (body) => {
          try {
            namespace.set(NS_RESPONSE_EXPRESS, body)
          } catch (e) { console.error(e) }
          old(body)
        }

        const { originalUrl, method } = req
        const originalPath = originalUrl.split('?')[0]
        const operationName = `${method} ${originalPath}`
        let span = null
        try {
          span = tracer.startSpan(operationName, { childOf: parent })
          span.addTags({
            component: 'express',
            'span.kind': 'server'
          })
          _logSpan('express startSpan', span)
          namespace.set(NS_SPAN_EXPRESS, span)
        } catch (e) { console.error(e) }

        res.on('finish', () => {
          try {
            const { statusCode, statusMessage } = res
            if (statusCode > 400) {
              span.addTags({ error: true })
              const data = namespace.get(NS_RESPONSE_EXPRESS)
              const { headers, query, body } = req
              span.log({ request: { headers, query, body }, response: { statusCode, statusMessage, data } })
            }
            namespace.set(NS_RESPONSE_EXPRESS, null)
            span.finish()
            _logSpan('express finishSpan', span)
          } catch (e) { console.error(e) }
        })
        next()
      })
    }

    function axiosMiddlewareRequest () {
      // span注入
      return (config) => {
        const { method, url } = config
        const operationName = `${method.toUpperCase()} ${url}`
        try {
        // 获取父级上下文
          let parent = namespace.get(NS_SPAN_EXPRESS)
          if (parent) {
            const span = tracer.startSpan(operationName, { childOf: parent })
            span.addTags({
              component: 'axios',
              'span.kind': 'client'
            })
            namespace.set(NS_SPAN_AXIOS, span)
            tracer.inject(span, FORMAT_HTTP_HEADERS, config.headers)
            _logSpan('axios startSpan', span)
          }
        } catch (e) { console.error(e) }
        return config
      }
    }

    function axiosMiddlewareResponse () {
      return (response) => {
        try {
          const span = namespace.get(NS_SPAN_AXIOS)
          if (span) {
            namespace.set(NS_SPAN_AXIOS, null)
            span.finish()
            _logSpan('axios finishSpan', span)
          }
        } catch (e) { console.error(e) }
        return response
      }
    }

    function axiosMiddlewareResponseError () {
      return (e) => {
        let { response, config } = e
        try {
          const span = namespace.get(NS_SPAN_AXIOS)
          if (span) {
            namespace.set(NS_SPAN_AXIOS, null)
            if (!response) {
              const { code, message } = e
              response = { status: code, statusText: message }
            }
            const { status: statusCode, statusText: statusMessage, data } = response
            span.addTags({ error: true })
            const { headers, params: query, data: body } = config
            span.log({ request: { headers, query, body }, response: { statusCode, statusMessage, data } })
            span.finish()
            _logSpan('axios finishSpan', span)
          }
        } catch (e) { console.error(e) }
        return Promise.reject(e)
      }
    }

    app.servers.http && (app.servers.http.middle.use(filterTracer))
    axios.interceptors.request.use(axiosMiddlewareRequest())
    axios.interceptors.response.use(axiosMiddlewareResponse(), axiosMiddlewareResponseError())
  }

  _logSpan (msg, span) {
    if (!this.debug) return
    const { operationName } = span
    logger.debug(this.name, msg, { operationName })
  }
}
