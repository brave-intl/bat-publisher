module.exports = {
  properties: { },

  build: function (cb) {
    const rule = {
      condition: 'SLD === \'youtube.com\' && pathname.indexOf(\'/channel/\') === 0',
      consequent: '\'youtube#channel:\' + pathname.split(\'/\')[2]',
      description: 'youtube channels'
    }
    cb(null, rule)
  }
}
