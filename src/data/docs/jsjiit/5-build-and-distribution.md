# Build and distribution

esbuild turns `src/index.js` into two ESM files. npm ships `dist/` and `src/`. jsDelivr mirrors the tarball.

Details: [Build system](5.1-build-system), [Package configuration](5.2-package-configuration), [Dependency management](5.3-dependency-management).

## Pipeline

```mermaid
flowchart LR
  src[src/index.js] --> build[node build.mjs]
  build --> min[dist/jsjiit.min.esm.js]
  build --> esm[dist/jsjiit.esm.js]
  min --> npm[npm publish]
  esm --> npm
  npm --> cdn[jsDelivr]
```

`prepare` runs `npm run build` so a publish always bundles.

## Dual bundle

```mermaid
flowchart TB
  common["commonConfig: bundle esm es2020 sourcemap"]
  common --> prod[minify true to jsjiit.min.esm.js]
  common --> dev[minify false to jsjiit.esm.js]
```

`package.json` `exports` point at the **unminified** file. CDN examples in these docs use the minified file on purpose.

## What npm includes

```mermaid
flowchart LR
  files["files: dist, src"] --> tarball
  npmignore[.npmignore] --> drop[docs, run_server, certs, node_modules]
```

`.gitignore` ignores `dist` and `docs`. GitHub does not store bundles. npm does, after `prepare`.

## Consumer paths

```mermaid
flowchart TB
  app[App]
  app -->|import jsjiit| pkg[dist/jsjiit.esm.js]
  app -->|jsDelivr min| min[jsjiit.min.esm.js]
  app -->|clone| src[src/index.js]
```

Version for this documentation: **0.0.22**. Confirm npm before assuming the registry still matches.
