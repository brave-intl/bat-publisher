const domains = [
  '3dmgame.com',
  '4399.com',
  '6park.com',
  'alodokter.com',
  'awkwardfamilyphotos.com',
  'azlyrics.com',
  'babycenter.com',
  'bodybuilding.com',
  'brainyquote.com',
  'dingit.tv',
  'diply.com',
  'douban.com',
  'feedly.com',
  'gamefaqs.com',
  'gamepedia.com',
  'gsmarena.com',
  'ign.com',
  'imdb.com',
  'kinopoisk.ru',
  'ozock.com',
  'providr.com',
  'redd.it',
  'reddit.com',
  'reddituploads.com',
  'scribol.com',
  'subscene.com',
  'superuser.com',
  'theladbible.com',
  'tripadvisor.com',
  'webtretho.com',
  'ycombinator.com',
  'yelp.com',
  'yesky.com'
]

module.exports = {
  properties: { domain: domains },

  build: function (cb) {
    const transformedList = domains.map((item) => { return `'${item}'` }).join(', ')
    const rule = {
      condition: `(new Set([ ${transformedList} ])).has(SLD)`,
      consequent: null,
      description: 'exclude aggregators'
    }
    cb(null, rule)
  }
}
