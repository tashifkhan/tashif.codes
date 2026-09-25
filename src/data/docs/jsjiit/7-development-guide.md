# Development guide

Work on the library clone: install, HTTPS test page, build, JSDoc, release notes.

- [Local development setup](7.1-local-development-setup)
- [Testing and validation](7.2-testing-and-validation)
- [Build and release process](7.3-build-and-release-process)

## Layout

```mermaid
flowchart TB
  root[jsjiit/]
  root --> src[src/]
  root --> buildmjs[build.mjs]
  root --> pkg[package.json]
  root --> test[test.html]
  root --> run[run_server]
  root --> jsdoc[jsdoc.conf.json]
  root --> gha[.github/workflows/jsdoc-build.yaml]
```

Fork to hack on: [https://github.com/tashifkhan/jsjiit](https://github.com/tashifkhan/jsjiit). Upstream package metadata still names `codeblech/jsjiit`.

## Loop

```mermaid
flowchart LR
  edit[edit src/*.js] --> serve[./run_server]
  serve --> page[https://localhost:8000/test.html]
  page --> portal[real StudentPortalAPI]
  edit --> bundle[npm run build]
```

There is no unit test suite. `"test"` exits 1.

## HTTPS

```mermaid
flowchart TD
  py[run_server Python] --> ossl[openssl self-signed cert]
  ossl --> https[HTTPS :8000]
  https --> subtle[crypto.subtle works]
```

Plain `python -m http.server` is the wrong tool if `subtle` is missing.

## Release sketch

```mermaid
flowchart LR
  bump[bump package.json 0.0.22] --> build[npm run build]
  build --> pub[npm publish]
  push[git push main] --> docs[jsdoc workflow]
```

Publishing npm is not automated in this repo. Only JSDoc on `main` is.
