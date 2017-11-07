#!/usr/bin/env node

/* jshint asi: true, node: true, laxbreak: true, laxcomma: true, undef: true, unused: true */

var levelup = require('../node_modules/level')
var path = require('path')
var underscore = require('../node_modules/underscore')

console.log('module.exports = { _: undefined')
var traverse = function (paths) {
  var data, name, splitP, stamp
  var lastamp = ''

  if (paths.length === 0) return console.log('}')

  name = path.basename(paths[0], '.leveldb')
  if (name.indexOf('rulesV2') === -1) {
    data = 'publishersV2'
    stamp = data
  } else {
    data = 'rulesetV2'
    splitP = true
    stamp = 'rulesV2'
  }

  console.log(', ' + data + ': [')
  levelup(paths[0]).createReadStream().on('data', function (data) {
    var pair, value

    try {
      value = JSON.parse(data.value)
      if (splitP) {
        pair = data.key.split(':')
        if (pair.length !== 2) throw new Error('invalid key')
        value.facet = pair[0]
        value.publisher = pair[1]
      } else {
        value.publisher = data.key
      }
      if (value.timestamp > lastamp) lastamp = value.timestamp
      console.log(JSON.stringify(value) + ',')
    } catch (ex) {
      console.log(ex.toString())
      console.log(JSON.stringify(data, null, 2))
      process.exit(1)
    }
  }).on('error', function (err) {
    console.log('err: ' + err.toString)
    process.exit(1)
  }).on('close', function () {
    traverse(underscore.rest(paths))
  }).on('end', function () {
    console.log('], ' + stamp + 'Stamp: ' + JSON.stringify(lastamp))
  })
}

traverse([
  process.env.HOME + '/Library/Application Support/brave/ledger-rulesV2.leveldb'
])
