const domains = [
  'baiducontent.com',
  'googleusercontent.com',
  'microsofttranslator.com',
  'youdao.com'
]

module.exports = {
  properties: { domain: domains },

  build: function (cb) {
    const transformedList = domains.map((item) => { return `'${item}'` }).join(', ')
    const rule = {
      condition: `(new Set([ ${transformedList} ])).has(SLD)`,
      consequent: null,
      description: 'exclude machine-translations'
    }
    cb(null, rule)
  }
}
