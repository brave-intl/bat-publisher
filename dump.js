var fs = require('fs')
var getPublisher = require('./index').getPublisher
var Synopsis = require('./index').Synopsis
var underscore = require('underscore')

var sites = JSON.parse(fs.readFileSync(process.env.HOME + '/Library/Application Support/Brave/session-store-1')).sites
var locations = {}
var publishers = {}

var synopsis = new Synopsis()

sites.forEach(function (site) {
  var markup, publisher
  var location = site.location

  if (location) synopsis.addVisit(location, Math.random() * 300 * 1000)

  if ((!location) || (locations[location])) return
  locations[location] = site

  try {
    if (location.indexOf('https://www.youtube.com/watch') !== -1) {
      try { markup = require('knodeo-http-sync').httpSync.get(location).toString() } catch (err) {}
    }

    publisher = getPublisher(location, markup)
    if (!publisher) return

    if (!publishers[publisher]) publishers[publisher] = []
    publishers[publisher].push(location)
  } catch (err) {
    console.log(location + ': ' + err.toString())
  }
})

var keys = underscore.keys(publishers).sort()
console.log('\npublishers:')
console.log(keys)

var mappings = {}
keys.forEach(function (publisher) {
  mappings[publisher] = publishers[publisher]
})
console.log('\nmappings:')
console.log(JSON.stringify(mappings, null, 2))

console.log('\ntopN:')
console.log(JSON.stringify(synopsis.topN(), null, 2))

console.log('\nallN:')
console.log(JSON.stringify(synopsis.allN(), null, 2))

console.log('\nwinner: ' + synopsis.winner())
