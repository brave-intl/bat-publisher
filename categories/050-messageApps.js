const SLDs = [
  'messenger',
  'skype',
  'whatsapp'
]

module.exports = {
  properties: { SLD: SLDs },

  build: function (cb) {
    const transformedList = SLDs.map((item) => { return `'${item}'` }).join(', ')
    const rule = {
      condition: `(new Set([ ${transformedList} ])).has(SLD.split('.')[0])`,
      consequent: null,
      description: 'exclude messaging application'
    }
    cb(null, rule)
  }
}
