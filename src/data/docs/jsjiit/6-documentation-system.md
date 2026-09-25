# Documentation system

JSDoc comments in `src/`, `jsdoc.conf.json`, `npm run docs`, and `.github/workflows/jsdoc-build.yaml` on `main`.

Config file: [JSDoc configuration](6.1-jsdoc-configuration). Pages job: [Automated documentation deployment](6.2-automated-documentation-deployment).

## Pieces

```mermaid
flowchart TB
  src[src/*.js README package.json] --> conf[jsdoc.conf.json]
  conf --> out[./docs]
  out --> local[open HTML locally]
  out --> gha[push main]
  gha --> pages[GitHub Pages]
```

JSDoc is API reference generated from comments. These markdown pages on tashif.codes are a separate site.

```mermaid
flowchart LR
  comments["@param @returns in wrapper.js"] --> html[JSDoc HTML]
  md[src/data/docs/jsjiit/*.md] --> site[tashif.codes]
```

## Local generate

```bash
npm run docs
```

runs `jsdoc -c jsdoc.conf.json --verbose`. Output directory `./docs` is gitignored.

## CI

```mermaid
flowchart LR
  push[push to main] --> ver["node -p require package.json version"]
  ver --> action[andstor/jsdoc-action]
  action --> dir["./docs/jsjiit/{version}"]
  dir --> gh[peaceiris/actions-gh-pages]
```

The workflow publishes `./docs/jsjiit/${version}`. Default JSDoc output is `./docs` (see `jsdoc.conf.json` `destination`). If the Action does not rewrite the destination, `publish_dir` may not match what JSDoc wrote. Check the workflow logs on a real run.

## Comments

Public classes in `wrapper.js`, models, and exceptions have `@param` / `@returns` / `@throws`. `fill_feedback_form` has almost no JSDoc. `feedback.js` has none.
