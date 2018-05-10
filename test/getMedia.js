const tap = require('tap')
const fs = require('fs')
const {onFavIcon, onFavIconOld} = require('../getMedia.js')

const blob = fs.readFileSync('./test/fixtures/photo.jpg')


onFavIcon({}, (error, publisherInfo) => {
  console.log(error, publisherInfo)
}, null, null, blob)

onFavIconOld({}, (error, publisherInfo) => {
  console.log(error, publisherInfo)
}, null, null, blob)
