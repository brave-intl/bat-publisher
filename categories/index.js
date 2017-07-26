const async = require('async')
const glob = require('glob')

const modules = glob.sync('[0-9]*.js', { cwd: __dirname }).sort()

const defaultRule = {
  condition: true,
  consequent: 'SLD',
  description: 'the default rule'
}

module.exports = {
  categories: function () {
    var categories = {}

    modules.forEach(function (module) {
      categories[module] = require('./' + module).properties
    })

    return categories
  },
  modules: function () {
    return modules
  },
  all: function (done) {
    const complete = (err, rules) => {
      if (err) {
        rules = null
      } else {
        rules = rules.concat(defaultRule)
      }
      done(err, rules)
    }
    async.map(modules, function (module, cb) {
      require('./' + module).build(cb)
    }, complete)
  }
}
