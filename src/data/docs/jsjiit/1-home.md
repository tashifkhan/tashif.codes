# Home

jsjiit is a browser JavaScript wrapper for the JIIT student WebPortal. It logs in, encrypts payloads, and calls `StudentPortalAPI` so a web app can read attendance, grades, exams, and account data without the portal UI.

This page matches package **0.0.22** in the clone at `/tmp/docs-refresh/jsjiit`. The README still shows CDN `jsjiit@0.0.20`. Pin **0.0.22** unless you have checked [npm](https://www.npmjs.com/package/jsjiit) or jsDelivr for a newer publish. JPortal has imported CDN **0.0.27**; that build may add things such as `useProxy` / `proxyUrl`. Those fields are **not** in this repo's `src/wrapper.js`. Do not assume they exist here.

Source: [tashifkhan/jsjiit](https://github.com/tashifkhan/jsjiit) (fork of [codeblech/jsjiit](https://github.com/codeblech/jsjiit)). Upstream Python: [pyjiit](https://github.com/codelif/pyjiit).

Install: [Getting started](2-getting-started). Methods: [API reference](3-api-reference). Internals: [Architecture and design](4-architecture-and-design).

## What it does

- Login through `student_login` with `DEFCAPTCHA` so you do not solve the image CAPTCHA
- Attendance metadata, semester totals, daily subject rows
- Registered subjects and faculty, subject choice print
- Exam events and schedules
- Grade card, SGPA/CGPA, marks PDF download
- Personal info, bank details, password change, hostel allocation, fee summary, pending fines
- Feedback submit via `fill_feedback_form`

It is an ES module (`"type": "module"`). Runtime is the browser: `fetch` plus `window.crypto.subtle`. There is no Node-compatible HTTP layer in 0.0.22.

## Modules

`src/index.js` re-exports the public surface. `src/wrapper.js` owns HTTP. Domain files own models.

```mermaid
flowchart TB
  idx["src/index.js"]
  wrap["src/wrapper.js<br/>WebPortal, WebPortalSession, API, DEFCAPTCHA"]
  att["src/attendance.js<br/>AttendanceHeader, Semester, AttendanceMeta"]
  reg["src/registration.js<br/>RegisteredSubject, Registrations"]
  exam["src/exam.js<br/>ExamEvent"]
  enc["src/encryption.js<br/>generate_local_name, serialize_payload"]
  ex["src/exceptions.js"]
  util["src/utils.js"]
  fb["src/feedback.js<br/>FeedbackOptions default export"]
  idx --> wrap
  idx --> att
  idx --> reg
  idx --> exam
  idx --> enc
  idx --> ex
  wrap --> att
  wrap --> reg
  wrap --> exam
  wrap --> enc
  wrap --> ex
  enc --> util
```

`FeedbackOptions` lives in `src/feedback.js` and is **not** re-exported from `src/index.js`. Call `fill_feedback_form` with strings such as `"EXCELLENT"`.

`WebPortal` holds `this.session`. Authenticated methods hang on `WebPortal`, not on `WebPortalSession`. `WebPortalSession` stores JWT fields and builds headers.

## Login and `__hit`

```mermaid
sequenceDiagram
  participant App
  participant WP as WebPortal
  participant Enc as encryption.js
  participant Portal as StudentPortalAPI
  App->>WP: student_login(user, pass)
  WP->>Enc: serialize_payload pret token
  WP->>Portal: POST /token/pretoken-check
  Portal-->>WP: response
  WP->>Enc: serialize_payload plus password
  WP->>Portal: POST /token/generate-token1
  Portal-->>WP: regdata plus JWT
  WP->>WP: session = new WebPortalSession
  App->>WP: get_attendance_meta
  WP->>WP: __hit authenticated
  WP->>Portal: POST with Bearer and LocalName
  Portal-->>App: AttendanceMeta
```

After login, most calls go through `WebPortal.__hit`. Authenticated requests use `session.get_headers()` (`Authorization: Bearer <jwt>` and `LocalName`). Unauthenticated requests still send `LocalName` from `generate_local_name()`. `__hit` does **not** call `deserialize_payload`. The portal returns JSON. `serialize_payload` encrypts many request bodies; some methods send plain JSON.

## Models and errors

| Class | File | Role |
| --- | --- | --- |
| `AttendanceHeader` | `attendance.js` | `branchdesc`, `name`, `programdesc`, `stynumber` |
| `Semester` | `attendance.js` | `registration_code`, `registration_id` from `registrationcode` / `registrationid` |
| `AttendanceMeta` | `attendance.js` | `headers`, `semesters`, `latest_header()`, `latest_semester()` |
| `RegisteredSubject` | `registration.js` | Faculty, credits, subject ids |
| `Registrations` | `registration.js` | `total_credits`, `subjects` |
| `ExamEvent` | `exam.js` | Event code, ids, `registration_id` |

| Error | Base | When |
| --- | --- | --- |
| `APIError` | `Error` | Default `__hit` failure |
| `LoginError` | `APIError` | Login endpoints |
| `AccountAPIError` | `Error` | `change_password` |
| `SessionError` | `Error` | Session base |
| `SessionExpired` | `SessionError` | HTTP 401 |
| `NotLoggedIn` | `SessionError` | `authenticated()` wrapper, `session == null` |

## Package and build

```mermaid
flowchart LR
  src["src/*.js"]
  build["build.mjs esbuild"]
  min["dist/jsjiit.min.esm.js"]
  dev["dist/jsjiit.esm.js"]
  npm["npm package 0.0.22"]
  cdn["jsDelivr"]
  src --> build
  build --> min
  build --> dev
  min --> npm
  dev --> npm
  npm --> cdn
```

- Name: `jsjiit`, version **0.0.22**, license ISC, author `codeblech`
- `main`: `src/index.js`
- `module` / `browser` / `exports.import` and `exports.require`: `dist/jsjiit.esm.js`
- `files`: `dist`, `src`
- Scripts: `build` → `node build.mjs`, `prepare` → `npm run build`, `docs` → `jsdoc -c jsdoc.conf.json --verbose`
- Dev deps only: `esbuild@0.24.0`, `jsdoc@^4.0.4`

## Minimal usage

```javascript
import { WebPortal } from "https://cdn.jsdelivr.net/npm/jsjiit@0.0.22/dist/jsjiit.min.esm.js";

const portal = new WebPortal();
await portal.student_login("username", "password");

const meta = await portal.get_attendance_meta();
const attendance = await portal.get_attendance(meta.latest_header(), meta.latest_semester());
```

Put that in `<script type="module">`. Credentials go to `https://webportal.jiit.ac.in:6011/StudentPortalAPI`. CORS and mixed-content rules apply.

## Next

- [Getting started](2-getting-started)
- [API reference](3-api-reference)
- [WebPortal class](3.1-webportal-class)
- [Build system](5.1-build-system)
- [Development guide](7-development-guide)
