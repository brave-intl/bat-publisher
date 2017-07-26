const domains = [
  'acm.nl',
  'consuwijzer.nl',
  'digid.nl',
  'europa.eu',
  'officielebekendmakingen.nl',
  'overheid.nl'
]

module.exports = {
  properties: { domain: domains },

  build: function (cb) {
    const transformedList = domains.map((item) => { return `'${item}'` }).join(', ')
    const rule = {
      condition: `(new Set([ ${transformedList} ])).has(SLD)`,
      consequent: null,
      description: 'exclude government sites'
    }
    cb(null, rule)
  }
}
