"use strict"

if (process.env.NODE_ENV === "production") {
  module.exports = require("./context-state.cjs.production.min.js")
} else {
  module.exports = require("./context-state.cjs.development.js")
}
