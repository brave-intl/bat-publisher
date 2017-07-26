const domains = [
  '163.com',
  'naver.com',
  'pixnet.net',
  'sohu.com'
]

module.exports = {
  properties: { domain: domains },

  build: function (cb) {
    const transformedList = domains.map((item) => { return `'${item}'` }).join(', ')
    const rule = {
      condition: `(new Set([ ${transformedList} ])).has(SLD)`,
      consequent: null,
      description: 'exclude news platforms'
    }
    cb(null, rule)
  }
}
