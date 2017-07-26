const domains = [
  '247exchange.com',
  'bitcointoyou.com',
  'bitgo.com',
  'bitx.co',
  'coinbase.com',
  'coinjar.com',
  'cubits.com',
  'okcoin.com',
  'quadrigacx.com',
  'uphold.com',
  'zebpay.com'
]

module.exports = {
  properties: { domain: domains },

  build: function (cb) {
    const transformedList = domains.map((item) => { return `'${item}'` }).join(', ')
    const rule = {
      condition: `(new Set([ ${transformedList} ])).has(SLD)`,
      consequent: null,
      description: 'exclude BTC exchanges'
    }
    cb(null, rule)
  }
}
