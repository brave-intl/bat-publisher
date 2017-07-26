/* jshint asi: true */

var fs = require('fs')
var Synopsis = require('./index').Synopsis

var synopsis = new Synopsis(
  fs.readFileSync(process.env.HOME + '/Library/Application Support/Brave/ledger-synopsis.json')
)

console.log('\n30 winners:')
console.log(synopsis.winners(30))
