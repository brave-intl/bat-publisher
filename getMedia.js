const http = require('http')
const https = require('https')
const querystring = require('querystring')
const url = require('url')

const backoff = require('@ambassify/backoff-strategies')
const jimp = require('jimp')
const NodeCache = require('node-cache')
const pcc = require('parse-cache-control')
const tldjs = require('tldjs')
const underscore = require('underscore')

const getPublisherFromMediaProps = (mediaProps, options, callback) => {
  const providerName = mediaProps.providerName.toLowerCase()
  let mediaURL

  if (!mappers[providerName]) return setTimeout(() => { callback(new Error('no mapper for ' + providerName)) }, 0)

  try {
    mediaURL = mappers[providerName](mediaProps)
  } catch (ex) {
    return setTimeout(() => { callback(ex) }, 0)
  }

  getPublisherFromMediaURL(mediaURL, options, callback)
}

const mappers = {
  twitch: (mediaProps) => {
    const mediaId = mediaProps.mediaId
    let parts

    if (!mediaId) throw new Error('expecting mediaId for provider Twitch')

    if (mediaId.indexOf('_vod_') === -1) return ('https://www.twitch.tv/' + mediaId)

    parts = mediaId.split('_vod_')
    return ('https://www.twitch.tv/' + parts[0] + '/v/' + parts[1])
  },

  youtube: (mediaProps) => {
    const mediaId = mediaProps.mediaId

    if (!mediaId) throw new Error('expecting mediaId for provider YouTube')

    return ('https://www.youtube.com/watch?v=' + mediaId)
  }
}

const getPublisherFromMediaURL = (mediaURL, options, callback) => {
  let domains, hostname, parts, providers

  if (typeof options === 'function') {
    callback = options
    options = {}
  }

  if (!options.ruleset) options.ruleset = module.exports.ruleset
  if (typeof options.roundtrip !== 'undefined') {
    if (typeof options.roundtrip !== 'function') throw new Error('invalid roundtrip option (must be a function)')
  } else if (options.debugP) options.roundtrip = roundTrip
  else throw new Error('security audit requires options.roundtrip for non-debug use')

  parts = url.parse(mediaURL)
  if ((!parts) || (parts.protocol !== 'https:')) return setTimeout(() => { callback(new Error('invalid URL'), null) }, 0)

  hostname = parts.hostname
  domains = [ hostname, tldjs.getDomain(hostname) ]

  if (hostname.indexOf('www.') === 0) domains.push('api.' + hostname.substr(4))

  providers = underscore.filter(options.ruleset, (rule) => {
    const schemes = rule.schemes

    if (!schemes.length) return (domains.indexOf(rule.domain) !== -1)

    for (let scheme in schemes) if (mediaURL.match(new RegExp(scheme.replace(/\*/g, '(.*)'), 'i'))) return true
  })

  getPublisherFromProviders(providers, mediaURL, options, null, callback)
}

const getPublisherFromProviders = (providers, mediaURL, options, firstErr, callback) => {
  const provider = underscore.first(providers)
  let parts, resolver

  const done = (err) => {
    setTimeout(() => { callback(firstErr || err, null) }, 0)
  }

  if (!provider) return done()

  resolver = resolvers[provider.provider_name]
  if (!resolver) return done(new Error('no resolver for ' + provider.provider_name))

  parts = url.parse(provider.url + '?' + querystring.stringify({ format: 'json', url: mediaURL }))

  cachedTrip({
    server: parts.protocol + '//' + parts.host,
    path: parts.path,
    timeout: options.timeout
  }, options, (err, response, payload) => {
    if (err) return next(providers, mediaURL, options, firstErr || err, callback)

    if (options.verboseP) console.log('\nmediaURL=' + mediaURL + ' oembed=' + JSON.stringify(payload, null, 2))

    resolver(providers, mediaURL, options, payload, firstErr, callback)
  })
}

const resolvers = {
  _channel: (providers, mediaURL, options, payload, firstErr, callback) => {
    const provider = underscore.first(providers)
    const parts = url.parse(payload.author_url)
    let paths

    paths = parts && parts.pathname.split('/')
    if ((!paths) || (!payload._channel.validP(paths))) throw new Error('invalid author_url: ' + payload.author_url)

    const inner = (publisherInfo) => {
      underscore.extend(publisherInfo, {
        TLD: publisherInfo.publisher.split(':')[0],
        SLD: publisherInfo.publisher,
        RLD: publisherInfo.providerValue,
        QLD: '',
        URL: publisherInfo.publisherURL
      })

      getPropertiesForPublisher(publisherInfo, options, (err, result) => {
        if ((err) && (options.verboseP)) {
          console.log('\ngetPropertiesForPublisher=' + publisherInfo.publisher + ': ' + err.toString())
        }

        if (!publisherInfo.faviconURL && !publisherInfo.faviconURL2) return callback(null, publisherInfo)

        getFaviconForPublisher(publisherInfo, publisherInfo.faviconURL, options, (err, result) => {
          if (!err) return callback(null, publisherInfo)

          if (options.verboseP) console.log('\ngetFavIconforPublisher=' + publisherInfo.faviconURL + ': ' + err.toString())

          getFaviconForPublisher(publisherInfo, publisherInfo.faviconURL2, options, (err, result) => {
            if (!err) return callback(null, publisherInfo)

            if (options.verboseP) console.log('\ngetFavIconforPublisher=' + publisherInfo.faviconURL2 + ': ' + err.toString())
          })
        })
      })
    }

    if (payload._channel.publisherInfo) return inner(payload._channel.publisherInfo)

    cachedTrip({
      server: parts.protocol + '//' + parts.host,
      path: parts.path,
      timeout: options.timeout
    }, underscore.extend({ windowP: true }, options), (err, response, body = {}) => {
      if (err) return next(providers, mediaURL, options, firstErr || err, callback)

      const parts = url.parse(body.url)
      const publisherInfo = {
        publisher: payload._channel.providerName + '#channel:' + payload._channel.get(paths, parts),
        publisherType: 'provider',
        publisherURL: payload.author_url + '/videos',
        providerName: provider.provider_name,
        providerSuffix: 'channel',
        providerValue: paths[2],
        faviconName: payload.author_name || body.title,
        faviconURL: body.image || payload.thumbnail_url
      }

      if (publisherInfo.faviconURL !== payload.thumbnail_url) publisherInfo.faviconURL2 = payload.thumbnail_url
      if (options.verboseP) console.log('\nmediaURL=' + mediaURL + ' scraper=' + JSON.stringify(body, null, 2))
      inner(publisherInfo)
    })
  },

  Twitch: (providers, mediaURL, options, payload, firstErr, callback) => {
    if (!payload) payload = { author_url: mediaURL }

    const parts = url.parse(payload.author_url)
    const paths = parts && parts.pathname.split('/')
    const provider = underscore.first(providers)

    const get = (paths, parts) => {
      const cpaths = parts && parts.pathname.split('/')

      return ((parts.pathname === parts.path) && (cpaths.length === 2) ? cpaths[1] : paths[1])
    }

    let providerValue = get(paths, parts)

    if (!payload.author_name) payload.author_name = providerValue

    resolvers._channel(providers, mediaURL, options, underscore.extend({
      _channel: {
        providerName: 'twitch',
        validP: (paths) => { return (paths.length === 2) },
        get: get,
        publisherInfo: {
          publisher: 'twitch#author:' + providerValue,
          publisherType: 'provider',
          publisherURL: payload.author_url + '/videos',
          providerName: provider.provider_name,
          providerSuffix: 'author',
          providerValue: providerValue,
          faviconName: payload.author_name,
          faviconURL: payload.author_thumbnail_url,
          faviconURL2: payload.thumbnail_url
        }
      }
    }, payload), firstErr, callback)
  },

  YouTube: (providers, mediaURL, options, payload, firstErr, callback) => {
    if (!payload) return next(providers, mediaURL, options, firstErr || new Error('empty oembed result'), callback)

    resolvers._channel(providers, mediaURL, options, underscore.extend({
      _channel: {
        providerName: 'youtube',
        validP: (paths) => { return (paths.length === 3) },
        get: (paths, parts) => {
          const cpaths = parts && parts.pathname.split('/')

          return ((parts.pathname === parts.path) && (cpaths.length === 3) && (cpaths[1] === 'channel') ? cpaths[2] : paths[2])
        }
      }
    }, payload), firstErr, callback)
  }
}

const next = (providers, mediaURL, options, firstErr, callback) => {
  getPublisherFromProviders(underscore.rest(providers), mediaURL, options, firstErr, callback)
}

const getPropertiesForPublisher = (publisherInfo, options, callback) => {
  const servers = {
    staging: {
      v2: 'https://ledger-staging.mercury.basicattentiontoken.org'
    },
    production: {
      v2: 'https://ledger.mercury.basicattentiontoken.org'
    }
  }

  retryTrip({
    server: servers[options.environment || 'production'][options.version || 'v2'],
    path: '/v3/publisher/identity?' + querystring.stringify({ publisher: publisherInfo.publisher }),
    timeout: options.timeout
  }, options, (err, response, payload) => {
    if (!err) publisherInfo.properties = payload.properties || {}

    callback(null, publisherInfo)
  })
}

const getFaviconForPublisher = (publisherInfo, faviconURL, options, callback) => {
  let parts, parts0

  if (!faviconURL) return callback(null, publisherInfo)

  parts = url.parse(faviconURL)
  if (!parts) return callback(new Error('invalid faviconURL: ' + faviconURL))

  if ((!parts.protocol) || (!parts.host)) {
    parts0 = url.parse(publisherInfo.publisherURL)
    if (!parts0) return callback(new Error('invalid publisherURL: ' + publisherInfo.publisherURL))

    if (!parts.protocol) parts.protocol = parts0.protocol
    if (!parts.host) parts.host = parts0.host
    if (!parts.port) parts.port = parts0.port
    if (!parts.hostname) parts.hostname = parts0.hostname
    faviconURL = url.format(parts)
  }

  cachedTrip({
    server: parts.protocol + '//' + parts.host,
    path: parts.path,
    timeout: options.timeout
  }, underscore.extend({ binaryP: true }, options), (err, response, body) => {
    if (err) return callback(err)

    jimp.read(body, (err, image) => {
      const bitmap = image && image.bitmap

      if (err) return callback(err)

      const dataURL = (err, base64) => {
        if (err) return callback(err)

        publisherInfo.faviconURL = base64
        callback(null, publisherInfo)
      }

      if ((bitmap.width <= 32) || (bitmap.height <= 32)) return image.getBase64(jimp.AUTO, dataURL)

      image.resize(32, 32).getBase64(jimp.AUTO, dataURL)
    })
  })
}

const cachedTrip = (params, options, callback, retry) => {
  const cache = module.exports.cache
  const data = cache && cache.get('url:' + params.server + params.path)

  if (data) return setTimeout(() => { callback(null, null, data) }, 0)

  retryTrip(params, options, (err, response, body) => {
    let cacheInfo, ttl

    if ((cache) && (!err) && response && response.headers) {
      cacheInfo = pcc(response.headers['cache-control'])
      if (cacheInfo) {
        if (!(cacheInfo.private || cacheInfo['no-cache'] || cacheInfo['no-store'])) ttl = cacheInfo['max-age']
      } else if (response.headers['expires']) ttl = new Date(response.headers['expires']).getTime() - underscore.now()

      cache.set('url:' + params.server + params.path, body, ttl || (60 * 60 * 1000))
    }

    callback(err, response, body)
  })
}

const retryTrip = (params, options, callback, retry) => {
  let method

  const loser = (reason) => { setTimeout(() => { callback(new Error(reason)) }, 0) }
  const rangeP = (n, min, max) => { return ((min <= n) && (n <= max) && (n === parseInt(n, 10))) }

  if (!retry) {
    retry = underscore.defaults(options.backoff || {}, {
      algorithm: 'binaryExponential', delay: 5 * 1000, retries: 3, tries: 0
    })
    if (!rangeP(retry.delay, 1, 30 * 1000)) return loser('invalid backoff delay')
    if (!rangeP(retry.retries, 0, 10)) return loser('invalid backoff retries')
    if (!rangeP(retry.tries, 0, retry.retries - 1)) return loser('invalid backoff tries')
  }
  method = retry.method || backoff[retry.algorithm]
  if (typeof method !== 'function') return loser('invalid backoff algorithm')
  method = method(retry.delay)

  options.roundtrip(params, options, (err, response, payload) => {
    let code

    if (!response) return callback(err, response, payload)

    code = Math.floor(response.statusCode / 100)
    if ((!err) || (code !== 5) || (retry.retries-- < 0)) return callback(err, response, payload)

    return setTimeout(() => { retryTrip(params, options, callback, retry) }, method(++retry.tries))
  })
}

const roundTrip = (params, options, callback) => {
  let request, timeoutP
  const encoding = options.binaryP ? 'binary' : 'utf8'
  const parts = url.parse(params.server)
  const client = parts.protocol === 'https:' ? https : http

  params = underscore.defaults(underscore.extend(underscore.pick(parts, 'protocol', 'hostname', 'port'), params),
                               { method: params.payload ? 'POST' : 'GET' })
  if (options.binaryP || options.scrapeP) options.rawP = true
  if (options.debugP) console.log('\nparams=' + JSON.stringify(params, null, 2))

  request = client.request(underscore.omit(params, [ 'payload', 'timeout' ]), (response) => {
    const chunks = []
    let body = ''

    if (timeoutP) return
    response.on('data', (chunk) => {
      if (typeof chunk === 'string') chunk = Buffer.from(chunk, encoding)
      chunks.push(chunk)
    }).on('end', () => {
      let payload

      if (params.timeout) request.setTimeout(0)

      body = Buffer.concat(chunks)
      if (options.verboseP) {
        console.log('>>> HTTP/' + response.httpVersionMajor + '.' + response.httpVersionMinor + ' ' + response.statusCode +
                   ' ' + (response.statusMessage || ''))
        underscore.keys(response.headers).forEach(function (header) {
          console.log('>>> ' + header + ': ' + response.headers[header])
        })
        console.log('>>> ' + (options.rawP ? '...' : body.toString() || '').split('\n').join('\n>>> '))
      }
      if (Math.floor(response.statusCode / 100) !== 2) {
        return callback(new Error('HTTP response ' + response.statusCode), response)
      }

      try {
        payload = options.rawP ? body : (response.statusCode !== 204) ? JSON.parse(body) : null
      } catch (err) {
        return callback(err, response)
      }

      try {
        callback(null, response, payload)
      } catch (err0) {
        if (options.verboseP) console.log('callback: ' + err0.toString() + '\n' + err0.stack)
      }
    }).setEncoding(encoding)
  }).on('error', (err) => {
    callback(err)
  }).on('timeout', () => {
    timeoutP = true
    callback(new Error('timeout'))
  })
  if (params.payload) request.write(JSON.stringify(params.payload))
  request.end()
  if (params.timeout) request.setTimeout(params.timeout)

  if (!options.verboseP) return

  console.log('<<< ' + params.method + ' ' + params.protocol + '//' + params.hostname + (params.path || ''))
  console.log('<<<')
  if (params.payload) console.log('<<< ' + JSON.stringify(params.payload, null, 2).split('\n').join('\n<<< '))
}

module.exports = {
  getPublisherFromMediaURL: getPublisherFromMediaURL,
  getPublisherFromMediaProps: getPublisherFromMediaProps,
  ruleset: require('./media/providers.json'),
  cache: new NodeCache()
}
