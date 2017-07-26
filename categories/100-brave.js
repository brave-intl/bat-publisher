const domains = [
  'brave.com'
]

module.exports = {
  properties: { domain: domains },

  build: function (cb) {
    const transformedList = domains.map((item) => { return `'${item}'` }).join(', ')
    const rule = {
      condition: `(new Set([ ${transformedList} ])).has(SLD)`,
      consequent: null,
      description: 'res ipsa loquitur'
    }
    cb(null, rule)
  }
}
