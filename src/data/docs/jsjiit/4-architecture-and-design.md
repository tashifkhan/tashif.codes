# Architecture and design

How 0.0.22 is split: a thin public barrel, one HTTP wrapper, domain files, Web Crypto, and esbuild. Closer looks: [System architecture overview](4.1-system-architecture-overview), [Encryption and security](4.2-encryption-and-security), [Module organization](4.3-module-organization).

## Layers

```mermaid
flowchart TB
  app[Browser app]
  idx[src/index.js]
  wrap[src/wrapper.js]
  models[attendance registration exam]
  enc[encryption.js plus utils.js]
  portal[StudentPortalAPI]
  app --> idx
  idx --> wrap
  wrap --> models
  wrap --> enc
  wrap --> portal
```

The app never talks to the portal except through `WebPortal`. Models do not fetch.

## Source files

```mermaid
flowchart LR
  index.js --> wrapper.js
  wrapper.js --> attendance.js
  wrapper.js --> registration.js
  wrapper.js --> exam.js
  wrapper.js --> encryption.js
  wrapper.js --> exceptions.js
  encryption.js --> utils.js
  index.js --> attendance.js
  index.js --> registration.js
  index.js --> exam.js
  index.js --> encryption.js
  index.js --> exceptions.js
```

`feedback.js` is imported by nobody. `fill_feedback_form` takes a string.

## Request path

```mermaid
sequenceDiagram
  participant App
  participant WP as WebPortal
  participant Auth as authenticated()
  participant Hit as __hit
  participant Enc as encryption.js
  participant Net as fetch
  App->>WP: get_attendance(...)
  WP->>Auth: session null?
  Auth->>Hit: POST URL options
  Hit->>Enc: generate_local_name or get_headers
  opt encrypted body
    Hit->>Enc: serialize_payload
  end
  Hit->>Net: fetch
  Net-->>App: JSON response
```

## Session vs methods

```mermaid
flowchart TB
  WP[WebPortal]
  S[WebPortalSession]
  WP -->|owns| S
  WP -->|implements| M[all data methods]
  S -->|implements| H[get_headers]
```

Older write-ups put `get_attendance` on the session class. In this source they are on `WebPortal`.

## Crypto placement

```mermaid
flowchart LR
  date[generate_date_seq] --> key[generate_key]
  key --> enc[encrypt / decrypt]
  rnd[get_random_char_seq] --> ln[generate_local_name]
  enc --> ln
  enc --> ser[serialize_payload]
  enc --> des[deserialize_payload]
```

`deserialize_payload` is unused by the wrapper. See [Encryption and security](4.2-encryption-and-security).

## Errors

```mermaid
flowchart TD
  proto[WebPortal.prototype] --> wrapAuth[authenticated wrapper]
  wrapAuth -->|null session| NL[NotLoggedIn]
  wrapAuth --> hit[__hit]
  hit --> APIErr[APIError or override]
  hit --> SE[SessionExpired]
```

## Ship path

```mermaid
flowchart LR
  src[src/] --> esb[esbuild ESM]
  esb --> dist[dist/*.esm.js]
  dist --> npm[npm 0.0.22]
  src --> jsdoc[jsdoc.conf.json]
  jsdoc --> pages[GitHub Pages job]
```

No runtime npm dependencies. Browser APIs only.
