const tap = require('tap')
const _ = require('underscore')

const {Synopsis} = require('../index.js')

let weights = [
  { publisher: '10%', weight: 0.10, pinPercentage: 10 },
  { publisher: '20%', weight: 0.20, pinPercentage: 20 },
  { publisher: 'nada', weight: 0.00, pinPercentage: 0 },
  { publisher: '30%', weight: 0.30, pinPercentage: 30 },
  { publisher: '25%', weight: 0.25, pinPercentage: 25 },
  { publisher: '15%', weight: 0.15, pinPercentage: 15 }
]

tap.same(Synopsis.prototype.winners(0, weights).length, 1)

tap.same(_.sortBy(Synopsis.prototype.winners(10, weights)),
  [ '10%', '15%', '15%', '20%', '20%', '25%', '25%', '30%', '30%', '30%' ])

weights = [
  { publisher: '30%', weight: 0.30, pinPercentage: 30 },
  { publisher: '20%', weight: 0.20, pinPercentage: 20 },
  { publisher: '10%', weight: 0.10, pinPercentage: 10 },
  { publisher: '05%', weight: 0.05, pinPercentage: 5 },
  { publisher: '17%', weight: 0.17 }
]
tap.same(_.sortBy(Synopsis.prototype.winners(10, weights)),
  [ '05%', '10%', '17%', '17%', '17%', '20%', '20%', '30%', '30%', '30%' ])

tap.same([], Synopsis.prototype.winners(92,
  [
    { publisher: 'brave.com', pinPercentage: undefined, weight: 0 }
  ]
))

tap.same([], Synopsis.prototype.winners(92,
  [
    { publisher: 'brave.com', pinPercentage: undefined, weight: 0 },
    { publisher: 'clifton.io', pinPercentage: undefined, weight: 0 }
  ]
))

tap.same([], Synopsis.prototype.winners(92,
  [
    { publisher: 'brave.com', pinPercentage: undefined, weight: 0 },
    { publisher: 'clifton.io', pinPercentage: undefined, weight: 0 },
    { publisher: 'brianbondy.com', pinPercentage: null, weight: 0 }
  ]
))

weights = [
  { publisher: '30%', weight: 0.30, pinPercentage: 30 },
  { publisher: '20%', weight: 0.20, pinPercentage: 20 },
  { publisher: '10%', weight: 0.10, pinPercentage: 10 },
  { publisher: '05%', weight: 0.05, pinPercentage: 5 },
  { publisher: '17%', weight: 0.17 },
  { publisher: 'brave.com', pinPercentage: undefined, weight: 0 },
  { publisher: 'clifton.io', pinPercentage: undefined, weight: 0 }
]

tap.same(_.sortBy(Synopsis.prototype.winners(10, weights)),
  [ '05%', '10%', '17%', '17%', '17%', '20%', '20%', '30%', '30%', '30%' ])

weights = [
  { publisher: '30%', weight: 0.30, pinPercentage: 30 },
  { publisher: '20%', weight: 0.20, pinPercentage: 20 },
  { publisher: '10%', weight: 0.10, pinPercentage: 10 },
  { publisher: '05%', weight: 0.05, pinPercentage: 5 },
  { publisher: '17%', weight: 0.17 },
  { publisher: 'brave.com', weight: 0 },
  { publisher: 'clifton.io', weight: 0 }
]

tap.same(_.sortBy(Synopsis.prototype.winners(10, weights)),
  [ '05%', '10%', '17%', '17%', '17%', '20%', '20%', '30%', '30%', '30%' ])

weights = [
  { publisher: '30%', weight: 0.30, pinPercentage: 30 },
  { publisher: '20%', weight: 0.20, pinPercentage: 20 },
  { publisher: '10%', weight: 0.10, pinPercentage: 10 },
  { publisher: '05%', weight: 0.05, pinPercentage: 5 },
  { publisher: '17%', weight: 0.17 },
  { publisher: 'brave.com' },
  { publisher: 'clifton.io', weight: undefined }
]

tap.same(_.sortBy(Synopsis.prototype.winners(10, weights)),
  [ '05%', '10%', '17%', '17%', '17%', '20%', '20%', '30%', '30%', '30%' ])
