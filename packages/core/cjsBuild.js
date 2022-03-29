const path = require("path")

const isProd = process.argv[2] === "--prod"

const fixCjsPlugin = {
  name: "fixCJS",
  setup(build) {
    build.onResolve({ filter: /useSyncExternalStore/ }, (args) => {
      return {
        path: path.join(args.resolveDir, args.path + "Cjs.ts"),
      }
    })
  },
}

require("esbuild")
  .build({
    entryPoints: ["src/index.tsx"],
    bundle: true,
    outfile: isProd
      ? "./dist/core.cjs.production.min.js"
      : "./dist/core.cjs.development.js",
    target: "es2015",
    minify: isProd,
    external: [
      "react",
      "rxjs",
      "@josepot/rxjs-state",
      "use-sync-external-store",
    ],
    format: "cjs",
    sourcemap: true,
    plugins: [fixCjsPlugin],
  })
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
