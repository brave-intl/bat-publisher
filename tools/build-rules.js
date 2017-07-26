const util = require('util')
const rules = require('../categories')

const opts = {
  depth: null,
  maxArrayLength: null
}

rules.all(function (err, definition) {
  if (err) throw err

  console.log('module.exports = ' + util.inspect(definition, opts))
})
