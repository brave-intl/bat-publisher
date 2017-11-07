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
  'zebpay.com',
  'bittrex.com',
  'kraken.com',
  'gdax.com',
  'poloniex.com',
  'coinone.co.kr',
  'quoine.com',
  'bitstamp.net',
  'bithumb.com',
  'hitbtc.com',
  'gemini.com',
  'bitflyer.jp',
  'bter.com',
  'cryptopia.co.nz',
  'gate.io',
  'etherdelta.com',
  'mercatox.com',
  'tidex.com',
  'bitso.com',
  'therocktrading.com',
  'coinexchange.io',
  'luno.com',
  'coinnest.co.kr',
  'bitmarket.net',
  'www.btcmarkets.net',
  'bx.in.th',
  'allcoin.com',
  'gatecoin.com',
  'exmo.com',
  'lakebtc.com',
  'quadrigacx.com',
  'acx.io',
  'liqui.io',
  'korbit.co.kr',
  'yobit.io',
  'cex.io'
]
// https://cryptocoincharts.info/markets/info for more

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
