const tap = require('tap')
const _ = require('underscore')

const {Synopsis} = require('../index.js')

const weights = [
  { publisher: '10%', weight: 0.10, pinPercentage: 10 },
  { publisher: '20%', weight: 0.20, pinPercentage: 20 },
  { publisher: 'nada', weight: 0.47, pinPercentage: 0 },
  { publisher: '30%', weight: 0.30, pinPercentage: 30 },
  { publisher: '25%', weight: 0.25, pinPercentage: 25 },
  { publisher: '15%', weight: 0.15, pinPercentage: 15 }
]

tap.same(_.sortBy(Synopsis.prototype.winners(10, weights)),
  ['10%', '15%', '15%', '20%', '20%', '25%', '25%', '30%', '30%', '30%'])
