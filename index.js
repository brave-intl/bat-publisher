var datax = require('data-expression')
var Joi = require('joi')
var jsdom = require('jsdom').jsdom
var random = require('random-lib')
var tldjs = require('tldjs')
var trim = require('underscore.string/trim')
var underscore = require('underscore')
var url = require('url')

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

var schema = Joi.array().min(1).items(Joi.object().keys(
  { condition: Joi.alternatives().try(Joi.string().description('a JavaScript boolean expression'),
                                      Joi.boolean().allow(true).description('only "true" makes sense')).required(),
    consequent: Joi.alternatives().try(Joi.string().description('a JavaScript string expression'),
                                      Joi.any().allow(false, null).description('or null').required()),
    dom: Joi.any().optional().description('DOM equivalent logic'),
    description: Joi.string().optional().description('a brief annotation')
  }
))

var getPublisher = function (location, markup, ruleset) {
  var consequent, i, result, rule
  var props = getPublisherProps(location)

  if (!props) return

  if ((!ruleset) && Array.isArray(markup)) {
    ruleset = markup
    markup = undefined
  }
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

var getPublisherProps = function (location) {
  var props

  if (!tldjs.isValid(location)) return

  props = url.parse(location, true)
  props.TLD = tldjs.getPublicSuffix(props.host)
  if (!props.TLD) return

  props = underscore.mapObject(props, function (value /* , key */) { if (!underscore.isFunction(value)) return value })
  props.URL = location
  props.SLD = tldjs.getDomain(props.host)
  props.RLD = tldjs.getSubdomain(props.host)
  props.QLD = props.RLD ? underscore.last(props.RLD.split('.')) : ''

  return props
}

var isPublisher = function (publisher) {
  var props
  var parts = publisher.split('/')

  if (!tldjs.isValid(parts[0])) return false
  if (parts.length === 1) return true

  props = url.parse('https://' + publisher)
  return ((!props.hash) && (!props.search))
}

var Synopsis = function (options) {
  var p

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
  underscore.defaults(this.options, { minPublisherDuration: 8 * 1000,
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
    var i
    var entry = this.publishers[publisher]

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
  var publisher

  if (duration < this.options.minPublisherDuration) return

  try { publisher = getPublisher(location, markup) } catch (ex) { return }
  if (!publisher) return

  return this.addPublisher(publisher, { duration: duration, markup: markup, revisitP: false })
}

Synopsis.prototype.initPublisher = function (publisher, now, props) {
  var entry = this.publishers[publisher]

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
  var entry, scores
  var now = underscore.now()

  if (!props) return

  if (typeof props === 'number') props = { duration: props }
  if ((!props.stickyP) && (props.duration < this.options.minPublisherDuration)) return

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
  var results = []
  var weights = {}

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
  var i, results, total

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
  var result = this.winners()

  return (result ? result[0] : result)
}

Synopsis.prototype.winners = function (n, weights) {
  var i, point, upper, winners
  var results = weights || this.topN()

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
  var emptyP = true
  var result = {}

  underscore.keys(Synopsis.prototype.scorekeepers).forEach(function (scorekeeper) {
    var score = Synopsis.prototype.scorekeepers[scorekeeper].bind(this)(props)

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
  var now = underscore.now()

  if (!then) then = now - (this.options.numFrames * this.options.frameSize)
  underscore.keys(this.publishers).forEach(function (publisher) {
    var i
    var duration = 0
    var entry = this.publishers[publisher]
    var scores = {}
    var visits = 0

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

    // do not delete the entry as it may have options
    if (visits === 0) return

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
  getCategories: require('./categories'),
  getRules: require('./categories').all,
  isPublisher: isPublisher,
// Note - the rules are dynamically built via the 'npm run build-rules' script (do not edit the rules/index.js file directly)
  ruleset: require('./rules'),
  schema: schema,
  Synopsis: Synopsis
}

var validity = Joi.validate(module.exports.ruleset, schema)
if (validity.error) throw new Error(validity.error)
