"use strict"

if (process.env.NODE_ENV === "production") {
  module.exports = require("./dom.cjs.production.min.js")
} else {
  module.exports = require("./dom.cjs.development.js")
}
