const underscore = require('underscore')

const rules = require('./node_modules/oembed-parser/src/utils/providers.json')

const providers = [ 'Twitch', 'YouTube' ]

const ruleset = []
rules.forEach((rule) => {
  let domain, endpoint, match

  if (providers.indexOf(rule.provider_name) === -1) return

  endpoint = rule.endpoints[0].url
  match = endpoint.match(/:\/\/(www[0-9]?\.)?(.[^/:]+)/i)
  if ((match) && (match.length > 2) && (typeof match[2] === 'string') && (match[2].length > 0)) domain = match[2]

  ruleset.push(underscore.extend(underscore.pick(rule, [ 'provider_name', 'provider_url' ]),
                                 { schemes: [], domain: domain || '', url: endpoint }))
})
console.log(JSON.stringify(ruleset, null, 2))
