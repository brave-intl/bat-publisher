#!/usr/bin/env node

var fs = require('fs')
var util = require('util')

if (process.argv.length !== 3) {
  console.log('usage: ' + process.argv[0] + ' ' + process.argv[1] + ' <report.json>')
  process.exit(1)
}

var rules = {}
var facets = []
var tags = []

JSON.parse(fs.readFileSync(process.argv[2])).forEach(function (rule) {
  var facet, tag

  if (rule.exclude !== true) return

  facet = rule.facet
  if (facets.indexOf(facet) === -1) facets.push(facet)

  tag = rule.tags.join(', ')
  if (tags.indexOf(tag) === -1) tags.push(tag)

  if (!rules[facet]) rules[facet] = {}
  if (!rules[facet][tag]) rules[facet][tag] = []
  if (rules[facet][tag].indexOf(rule.publisher) === -1) rules[facet][tag].push(rule.publisher)
})
// console.log(JSON.stringify(rules, null, 2))

var regexpEscape = function (s) { return s.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&') }

var exports = []
facets.forEach(function (facet) {
  tags.forEach(function (tag) {
    var condition = ''

    if (!rules[facet][tag]) return

    if (facet === 'SLD') {
      rules[facet][tag].forEach(function (suffix) {
        if (condition) {
          condition += ', '
        } else {
          condition = '(new Set([ '
        }
        condition += '"' + suffix + '"'
      })
      condition += ' ])).has(SLD.split(".")[0])'
    } else if (facet === 'TLD') {
      rules[facet][tag].forEach(function (domain) {
        if (domain.indexOf('^') !== -1) {
          condition = '/' + domain + '/.test(TLD)'
        } else {
          condition = 'TLD === "' + domain + '"'
        }
        exports.push({ condition: condition,
          consequent: null,
          description: 'exclude ' + facet + ' ' + (tag ? (tag + ' ') : '') + domain
        })
      })
      condition = null
    } else {
      rules[facet][tag].forEach(function (domain) {
        if (condition) condition += ' || '
        condition += '/^' + regexpEscape(domain) + '$/.test(SLD)'
      })
    }
    if (condition) {
      exports.push({ condition: condition,
        consequent: null,
        description: 'exclude ' + facet + (tag ? (' ' + tag) : '')
      })
    }
  })
})
exports.push({ condition: true, consequent: 'SLD', description: 'the default rule' })
console.log('module.exports = ' + util.inspect(exports, { depth: null, maxArrayLength: null }))
