const querystring = require('querystring')
const url = require('url')

const Joi = require('joi')
const datax = require('data-expression')
const npminfo = require('./package.json')
const random = require('random-lib')
const tldjs = require('tldjs')
const trim = require('underscore.string/trim')
const underscore = require('underscore')

/* foo.bar.example.com
    QLD = 'bar'
    RLD = 'foo.bar'
    SLD = 'example.com'
    TLD = 'com'

   search.yahoo.co.jp
    QLD = 'search'
    RLD = 'search'
    SLD = 'yahoo.co.jp'
    TLD = 'co.jp'
 */

const schema = Joi.array().min(1).items(Joi.object().keys(
  { condition: Joi.alternatives().try(Joi.string().description('a JavaScript boolean expression'),
                                      Joi.boolean().allow(true).description('only "true" makes sense')).required(),
    consequent: Joi.alternatives().try(Joi.string().description('a JavaScript string expression'),
                                      Joi.any().allow(false, null).description('or null').required()),
    dom: Joi.any().optional().description('DOM equivalent logic'),
    description: Joi.string().optional().description('a brief annotation')
  }
))

const providerRE = /^([A-Za-z0-9][A-Za-z0-9-]{0,62})#([A-Za-z0-9][A-Za-z0-9-]{0,62}):(([A-Za-z0-9-._~]|%[0-9A-F]{2})+)$/

let jsdom

const getPublisher = (location, markup, ruleset) => {
  const props = getPublisherProps(location)
  let consequent, i, result, rule

  if (!props) return

  if ((!ruleset) && Array.isArray(markup)) {
    ruleset = markup
    markup = undefined
  }

  if (!jsdom) jsdom = require('jsdom').jsdom

  if (!ruleset) ruleset = module.exports.ruleset
  for (i = 0; i < ruleset.length; i++) {
    rule = ruleset[i]

    if (!datax.evaluate(rule.condition, props)) continue

    if ((rule.dom) && (rule.dom.publisher)) {
      if (!markup) throw new Error('markup parameter required')

      if (typeof markup !== 'string') markup = markup.toString()

      props.node = jsdom(markup).body.querySelector(rule.dom.publisher.nodeSelector)
      consequent = rule.dom.publisher.consequent
    } else {
      delete props.node
      consequent = rule.consequent
    }

    result = consequent ? datax.evaluate(consequent, props) : consequent
    if (result === '') continue

    if (typeof result === 'string') return trim(result, './')

    // map null/false to undefined
    return
  }
}

const getPublisherProps = (location) => {
  const provider = providerRE.exec(location)
  let props

  if (provider) {
    props = {
      publisher: provider[0],
      publisherType: 'provider',
      providerName: provider[1],
      providerSuffix: provider[2],
      providerValue: querystring.unescape(provider[3])
    }
    underscore.extend(props, {
      TLD: props.publisher.split(':')[0],
      SLD: props.publisher,
      RLD: props.providerValue,
      QLD: ''
    })
    if ((props.providerName.toLowerCase() === 'youtube') && (props.providerSuffix === 'channel')) {
      props.URL = 'https://www.youtube.com/channel/' + props.providerValue
    }
    return props
  }

  if (location.indexOf('://') === -1) location = 'https://' + location
  props = url.parse(location, true)
  if ((!props) || (!tldjs.isValid(props.hostname))) return

  props.TLD = tldjs.getPublicSuffix(props.hostname)
  if (!props.TLD) return

  props = underscore.mapObject(props, (value /* , key */) => { if (!underscore.isFunction(value)) return value })
  props.URL = location
  props.SLD = tldjs.getDomain(props.hostname)
  props.RLD = tldjs.getSubdomain(props.hostname)
  props.QLD = props.RLD ? underscore.last(props.RLD.split('.')) : ''

  return props
}

//  cf., https://github.com/brave-intl/bat-publisher#syntax

const isPublisher = (publisher) => {
  const parts = publisher.split('/')
  let props

  if (providerRE.test(publisher)) return true

  // we could use an RE, but why reproduce all that effort?
  if (!tldjs.isValid(parts[0])) return false
  if (parts.length === 1) return true

  props = url.parse('https://' + publisher)
  return ((!!props) && (!props.hash) && (!props.search))
}

const Synopsis = function (options) {
  let p

  this.publishers = {}
  if ((typeof options === 'string') || (Buffer.isBuffer(options))) {
    p = JSON.parse(options)
  } else if ((typeof options === 'object') && options.options) {
    p = options
  }

  if (p && p.options) options = p.options
  if (p && p.publishers) this.publishers = p.publishers

  this.options = options || {}
  this.options.scorekeepers = underscore.keys(Synopsis.prototype.scorekeepers)
  underscore.defaults(this.options, {
    minPublisherDuration: 8 * 1000,
    numFrames: 30,
    frameSize: 24 * 60 * 60 * 1000,
    _d: 1 / (30 * 1000),
    minPublisherVisits: 0
  })
  if (!this.options.scorekeepers[this.options.scorekeeper]) {
    this.options.scorekeeper = underscore.first(this.options.scorekeepers)
  }
  this.options.emptyScores = {}
  this.options.scorekeepers.forEach(function (scorekeeper) {
    this.options.emptyScores[scorekeeper] = 0
  }, this)

  underscore.defaults(this.options, { _a: (1 / (this.options._d * 2)) - this.options.minPublisherDuration })
  this.options._a2 = this.options._a * 2
  this.options._a4 = this.options._a2 * 2
  underscore.defaults(this.options, { _b: this.options.minPublisherDuration - this.options._a })
  this.options._b2 = this.options._b * this.options._b

  underscore.keys(this.publishers).forEach(function (publisher) {
    const entry = this.publishers[publisher]
    let i

// NB: legacy support
    if (typeof entry.options === 'undefined') entry.options = {}
    if (typeof entry.scores === 'undefined') {
      entry.scores = underscore.clone(this.options.emptyScores)
      if (entry.score) {
        entry.scores.concave = entry.score
        entry.scores.visits = entry.visits
        delete entry.score
      }
    }
    for (i = 0; i < entry.window.length; i++) {
      if (typeof entry.window[i].scores !== 'undefined') continue

      entry.window[i].scores = underscore.clone(this.options.emptyScores)
      if (entry.window[i].score) {
        entry.window[i].scores.concave = entry.window[i].score
        entry.window[i].scores.visits = entry.window[i].visits
        delete entry.window[i].score
      }
    }
  }, this)
}

Synopsis.prototype.addVisit = function (location, duration, markup) {
  let publisher

  if (duration < this.options.minPublisherDuration) return

  try { publisher = getPublisher(location, markup) } catch (ex) { return }
  if (!publisher) return

  return this.addPublisher(publisher, { duration: duration, markup: markup, revisitP: false })
}

Synopsis.prototype.initPublisher = function (publisher, now, props) {
  const entry = this.publishers[publisher]

  if (!props) props = {}
  if (entry) {
    if (!entry.options) entry.options = {}
    entry.options.stickyP = props.stickyP

    if ((!entry.window) || (!entry.window.length)) {
      entry.window = [ { timestamp: now, visits: entry.visits, duration: entry.duration, scores: entry.scores } ]
    }

    return
  }

  this.publishers[publisher] = { visits: 0,
    duration: 0,
    options: { stickyP: props.stickyP },
    scores: underscore.clone(this.options.emptyScores),
    window: [ { timestamp: underscore.now(),
      visits: 0,
      duration: 0,
      scores: underscore.clone(this.options.emptyScores) } ]
  }
}

Synopsis.prototype.addPublisher = function (publisher, props) {
  const now = underscore.now()
  let entry, scores

  if (!props) return

  if (typeof props === 'number') props = { duration: props }
  if (((!props.stickyP) && (!props.ignoreMinTime)) && (props.duration < this.options.minPublisherDuration)) return

  scores = this.scores(props)
  if (!scores) return

  this.initPublisher(publisher, now, props)
  entry = this.publishers[publisher]

  if (entry.window[0].timestamp <= now - this.options.frameSize) {
    entry.window = [ { timestamp: now,
      visits: 0,
      duration: 0,
      scores: underscore.clone(this.options.emptyScores) }].concat(entry.window)
  }

  if (!props.revisitP) entry.window[0].visits++
  entry.window[0].duration += props.duration
  underscore.keys(scores).forEach(function (scorekeeper) {
    if (!entry.window[0].scores[scorekeeper]) entry.window[0].scores[scorekeeper] = 0
    entry.window[0].scores[scorekeeper] += scores[scorekeeper]
  }, this)

  if (!props.revisitP) entry.visits++
  entry.duration += props.duration
  underscore.keys(scores).forEach(function (scorekeeper) {
    if (!entry.scores[scorekeeper]) entry.scores[scorekeeper] = 0
    entry.scores[scorekeeper] += scores[scorekeeper]
  }, this)

  return publisher
}

Synopsis.prototype.topN = function (n) {
  return this._topN(n, this.options.scorekeeper)
}

Synopsis.prototype.allN = function (n) {
  const results = []
  const weights = {}

  underscore.keys(Synopsis.prototype.scorekeepers).forEach(function (scorekeeper) {
    (this._topN(n, scorekeeper, true) || []).forEach(function (entry) {
      if (!weights[entry.publisher]) weights[entry.publisher] = underscore.clone(this.options.emptyScores)
      weights[entry.publisher][scorekeeper] = entry.weight
    }, this)
  }, this)

  underscore.keys(weights).forEach(function (publisher) {
    results.push(underscore.extend({ weights: weights[publisher] },
                                   underscore.pick(this.publishers[publisher], [ 'scores', 'visits', 'duration', 'window' ])))
  }, this)

  return results
}

Synopsis.prototype._topN = function (n, scorekeeper, allP) {
  let i, results, total

  this.prune()

  results = []
  underscore.keys(this.publishers).forEach(function (publisher) {
    if (!this.publishers[publisher].scores[scorekeeper]) return

    if (!this.publishers[publisher].options.stickyP) {
      if ((!allP) &&
            ((this.options.minPublisherDuration > this.publishers[publisher].duration) ||
             (this.options.minPublisherVisits > this.publishers[publisher].vists))) return
    }

    results.push(underscore.extend({ publisher: publisher }, underscore.omit(this.publishers[publisher], 'window')))
  }, this)
  results = underscore.sortBy(results, function (entry) { return -entry.scores[scorekeeper] })

  if ((n > 0) && (results.length > n)) results = results.slice(0, n)
  n = results.length

  total = 0
  for (i = 0; i < n; i++) { total += results[i].scores[scorekeeper] }
  if (total === 0) return

  for (i = 0; i < n; i++) {
    results[i] = { publisher: results[i].publisher, weight: results[i].scores[scorekeeper] / total }
  }

  return results
}

Synopsis.prototype.winner = function () {
  const result = this.winners()

  return (result ? result[0] : result)
}

Synopsis.prototype.winners = function (n, weights) {
  const results = weights || this.topN()
  let i, point, upper, winners

  if (!results) return

  winners = []

  if ((typeof n !== 'number') || (n < 1)) n = 1
  underscore.times(n, function () {
    point = random.randomFloat()
    upper = 0

    for (i = 0; i < results.length; i++) {
      upper += results[i].weight
      if (upper < point) continue

      winners.push(results[i].publisher)
      break
    }
  })

  return winners
}

Synopsis.prototype.toJSON = function () {
  this.prune()

  return { options: this.options, publishers: this.publishers }
}

Synopsis.prototype.scores = function (props) {
  const result = {}
  let emptyP = true

  underscore.keys(Synopsis.prototype.scorekeepers).forEach(function (scorekeeper) {
    let score = Synopsis.prototype.scorekeepers[scorekeeper].bind(this)(props)

    result[scorekeeper] = score > 0 ? score : 0
    if ((score === 0) && (props.stickyP)) score = 1
    if (score > 0) emptyP = false
  }, this)

  if (!emptyP) return result
}

Synopsis.prototype.scorekeepers = {}

// courtesy of @dimitry-xyz: https://github.com/brave/ledger/issues/2#issuecomment-221752002
Synopsis.prototype.scorekeepers.concave = function (props) {
  return (((-this.options._b) + Math.sqrt(this.options._b2 + (this.options._a4 * props.duration))) / this.options._a2)
}

Synopsis.prototype.scorekeepers.visits = function (/* props */) {
  return 1
}

Synopsis.prototype.prune = function (then) {
  const now = underscore.now()

  if (!then) then = now - (this.options.numFrames * this.options.frameSize)
  underscore.keys(this.publishers).forEach(function (publisher) {
    const entry = this.publishers[publisher]
    const scores = {}
    let i
    let duration = 0
    let visits = 0

    // NB: in case of user editing...
    if ((!entry.window) || (!entry.window.length)) {
      entry.window = [ { timestamp: now, visits: entry.visits, duration: entry.duration, scores: entry.scores } ]
      return
    }

    for (i = 0; i < entry.window.length; i++) {
      if (entry.window[i].timestamp < then) break

      visits += entry.window[i].visits
      duration += entry.window[i].duration
      underscore.keys(entry.window[i].scores).forEach(function (scorekeeper) {
        if (!scores[scorekeeper]) scores[scorekeeper] = 0
        scores[scorekeeper] += entry.window[i].scores[scorekeeper]
      }, this)
    }

    if (visits === 0) {
      // do not delete the entry if it has options
      if ((!entry.options) || (!entry.options.exclude)) {
        delete this.publishers[publisher]
        return
      }

      entry.visits = 0
      entry.duration = 0
      entry.scores = underscore.clone(this.options.emptyScores)
      entry.window = [ { timestamp: now, visits: entry.visits, duration: entry.duration, scores: entry.scores } ]
      return
    }

    if (i < entry.window.length) {
      entry.visits = visits
      entry.duration = duration
      entry.scores = scores
      entry.window = entry.window.slice(0, i)
    }
  }, this)
}

module.exports = {
  getPublisher: getPublisher,
  getPublisherProps: getPublisherProps,
  getCategories: () => { return require('./categories') },
  getRules: (done) => { return require('./categories').all(done) },
  getMedia: () => { return require('./getMedia') },
  isPublisher: isPublisher,
// Note - the rules are dynamically built via the 'npm run build-rules' script (do not edit the rules/index.js file directly)
  ruleset: () => { return require('./rules') },
  schema: schema,
  Synopsis: Synopsis,
  version: npminfo.version
}

if (process.env.LEDGER_DEBUG) {
  const ruleset = typeof module.exports.ruleset === 'function' ? module.exports.ruleset() : module.exports.ruleset
  const validity = Joi.validate(ruleset, schema)

  if (validity.error) throw new Error(validity.error)
}
