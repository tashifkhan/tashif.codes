# Architecture overview

How JPortal is put together: stack, routing, portal instances, and the patterns that show up everywhere.

Subsystem docs:

* Authentication and routing: [Application Structure & Authentication](3.1-application-structure-and-authentication)
* State: [State Management Strategy](3.2-state-management-strategy)
* Data: [Data Layer & API Integration](3.3-data-layer-and-api-integration)
* Theme: [Theme System](3.4-theme-system)
* Features: [Feature Modules](4-feature-modules)

## Technology stack

SPA in `jportal/`. Versions from `package.json`.

| Category | Technologies | Purpose |
| --- | --- | --- |
| UI | React 18.3.1 | Components |
| Build | Vite 7.3.1 | Dev server and bundle |
| Routing | React Router DOM 6.27.0 | `HashRouter` |
| Primitives | Radix UI | Dialog, Select, Tabs, Sheet |
| CSS | Tailwind CSS 4.1.12, CVA | Utilities and variants |
| Feature state | `useState` / `useEffect` | Lifted onto `AuthenticatedApp` |
| Theme state | Zustand 5.0.8 | `src/stores/theme-store.ts` |
| Forms | React Hook Form 7.53.1, Zod 3.23.8 | Login |
| Charts | Recharts 2.15.4 | GPA, attendance, stats |
| Server state | TanStack Query 5.90.2 | Cloudflare hooks in `src/hooks/cloudflare.ts` |
| PWA | `vite-plugin-pwa` 1.2.0, Workbox | SW and manifest |
| Portal | jsjiit 0.0.27 CDN | `WebPortal`, `LoginError` |
| Python in browser | Pyodide 0.23.4 | Marks PDF parse |

TanStack Query is used on `/stats`. Attendance and Grades still fetch with `useEffect` and parent state.

## Application entry point and bootstrap

### HTML and script loading

```mermaid
flowchart TD
  indexHtml["index.html"] --> fonts["Google Fonts preconnect + stylesheet"]
  indexHtml --> beacon["Cloudflare beacon.min.js"]
  indexHtml --> pyodide["cdn.jsdelivr.net/pyodide/v0.23.4"]
  indexHtml --> main["script type=module src=/src/main.jsx"]
```

### Main entry point

```mermaid
flowchart TD
  main["src/main.jsx"] --> css["index.css"]
  main --> root["createRoot(#root)"]
  root --> App["App.jsx"]
```

`main.jsx` only mounts `App`. Theme and Query providers live in `App`.

## Application architecture

### Top-level component structure

```mermaid
flowchart TD
  App["App"] --> TS["ThemeScript"]
  App --> TP["ThemeProvider"]
  TP --> Font["DynamicFontLoader"]
  TP --> QC["QueryClientProvider"]
  QC --> Toast["Toaster sonner"]
  QC --> Router["HashRouter"]
  Router --> Stats["/stats Cloudflare"]
  Router --> Gate{"isAuthenticated"}
  Gate -->|no| Login["LoginWrapper"]
  Gate -->|yes| Auth["AuthenticatedApp"]
```

State on `App`:

* `isAuthenticated`
* `isDemoMode`
* `isLoading` (auto-login)
* `error`

### Portal instance management

```mermaid
flowchart LR
  Mod["App.jsx module scope"] --> Real["realPortal WebPortal useProxy proxyUrl onrender"]
  Mod --> Mock["mockPortal MockWebPortal"]
  App["App"] --> Flag{"isDemoMode"}
  Flag -->|false| Real
  Flag -->|true| Mock
  Real --> W["w prop"]
  Mock --> W
```

## Routing architecture

### Route structure

```mermaid
flowchart TD
  HR["HashRouter"] --> Stats["path /stats public"]
  HR --> Star{"isAuthenticated"}
  Star -->|false| Catch["path * LoginWrapper"]
  Star -->|true| Rest["path /* AuthenticatedApp"]
```

### AuthenticatedApp internal routing

```mermaid
flowchart TD
  AA["AuthenticatedApp"] --> Header["sticky Header"]
  AA --> R["Routes"]
  AA --> Nav["Navbar"]
  R --> Redir["/ and /login -> /attendance"]
  R --> Att["/attendance"]
  R --> Gr["/grades"]
  R --> Ex["/exams"]
  R --> Sub["/subjects"]
  R --> Pr["/profile"]
```

## State management architecture

### State hierarchy

```mermaid
flowchart TD
  App["App auth + demo flag"] --> AA["AuthenticatedApp feature caches"]
  AA --> Feat["Attendance Grades Exams Subjects Profile"]
  Theme["useThemeStore"] --> Header
  Theme --> Cards["feature cards"]
  LS["localStorage"] --> App
  LS --> AA
```

Persisted:

* `attendanceGoal` (default 75)
* `username` / `password` for auto-login

### State flow to feature components

```mermaid
flowchart LR
  AA["AuthenticatedApp"] -->|"attendance* props"| Att["Attendance"]
  AA -->|"grades* marks* gradeCard*"| Gr["Grades"]
  AA -->|"exam*"| Ex["Exams"]
  AA -->|"subject* choices*"| Sub["Subjects"]
  AA -->|"profileData"| Pr["Profile"]
```

## Data access layer: portal abstraction

### Portal `w` switch

```mermaid
flowchart TD
  Comp["feature component"] --> Call["await w.method(...)"]
  Call --> Impl{"w constructor"}
  Impl -->|WebPortal| CDN["jsjiit 0.0.27"]
  Impl -->|MockWebPortal| JSON["fakedata.json"]
```

Portal methods in this app:

* `student_login(username, password)`
* `get_attendance_meta()`, `get_attendance(header, semester)`, `get_subject_daily_attendance(...)`
* `get_registered_semesters()`, `get_registered_subjects_and_faculties(semester)`, `get_subject_choices(semester)`
* `get_semesters_for_exam_events()`, `get_exam_events(semester)`, `get_exam_schedule(event)`
* `get_sgpa_cgpa()`, `get_semesters_for_grade_card()`, `get_grade_card(semester)`
* `get_semesters_for_marks()`, `download_marks(semester)`
* `get_personal_info()`

Do not invent `get_grades()` or `get_header()` as feature APIs. Attendance uses `meta.latest_header()`.

### Login flow

```mermaid
sequenceDiagram
  participant User
  participant Login
  participant W as w.student_login
  participant LS as localStorage
  participant App

  User->>Login: submit enrollment + password
  Login->>W: student_login
  W-->>Login: session or LoginError
  Login->>LS: set username password
  Login->>App: onLoginSuccess
  App->>App: setIsAuthenticated true
```

Auto-login on mount uses stored credentials against `realPortal` only.

## Theme infrastructure

### Theme state management with zustand

```mermaid
flowchart LR
  Presets["theme-presets.ts defaultPresets"] --> Store["useThemeStore persist"]
  Store --> Provider["ThemeProvider"]
  Provider --> Root["documentElement CSS vars"]
  Selector["ThemeSelectorDialog"] --> Store
```

### Dynamic font loading

```mermaid
flowchart TD
  Preset["theme styles font-sans"] --> Extract["extractFontFamily"]
  Extract --> Skip{"system font?"}
  Skip -->|yes| Stop["skip"]
  Skip -->|no| URL["buildFontCssUrl family 400 500 600 700"]
  URL --> Link["loadGoogleFont append link"]
```

`src/utils/fonts.ts` owns `extractFontFamily`, `buildFontCssUrl`, `loadGoogleFont`. Default weights: `["400", "500", "600", "700"]`.

## Component architecture patterns

### Feature module pattern

| Aspect | Implementation |
| --- | --- |
| Props | `w`, caches, setters from `AuthenticatedApp` |
| Fetch | `useEffect` calling `w.method()` |
| Cache | Objects keyed by `registration_id` or event id |
| Loading | Booleans such as `gradesLoading`, `isAttendanceMetaLoading` |
| Errors | try/catch plus `gradesError` or cached `{ error }` |

Attendance is the heaviest prop list: `w`, `attendanceData`, semesters, goal, subject daily cache, tabs, calendar, tracker, cache status.

### Global UI components

```mermaid
flowchart TD
  AA["AuthenticatedApp"] --> Header["Header"]
  Header --> StatsLink["Link /stats"]
  Header --> ThemeBtn["ThemeSelectorDialog"]
  Header --> Logout["handleLogout"]
  AA --> Navbar["Navbar NavLink"]
  Navbar --> Five["attendance grades exams subjects profile"]
```

## External service integration

```mermaid
flowchart TD
  App --> jsjiit["jsjiit@0.0.27 ESM CDN"]
  jsjiit --> Proxy["jportal-cors-proxy.onrender.com"]
  Proxy --> Portal["webportal.jiit.ac.in"]
  Grades --> Pyodide["Pyodide + PyMuPDF + jiit_marks"]
  Stats["Cloudflare.jsx"] --> Hooks["useFetchWebAnalytics*"]
  Hooks --> API["POST /api/analytics"]
  API --> CF["Cloudflare GraphQL"]
  indexHtml --> Beacon["beacon.min.js"]
```

jsjiit import:

```
import { WebPortal, LoginError } from
  "https://cdn.jsdelivr.net/npm/jsjiit@0.0.27/dist/jsjiit.esm.js";
```

Pyodide is loaded from CDN in `index.html`. Grades uses it to parse marks PDFs.

## Error handling and loading states

```mermaid
flowchart TD
  Auto["App performLogin"] --> Err{"LoginError?"}
  Err -->|unavailable| Msg1["JIIT Web Portal server is temporarily unavailable"]
  Err -->|Failed to fetch| Msg2["check internet / portal down"]
  Err -->|other| Msg3["Auto-login failed"]
  Err --> Clear["remove username password"]
```

Feature-level errors (example `gradesError`) stay on `AuthenticatedApp`. Toasts use sonner.

## Summary

1. `App` gates auth. `/stats` is public.
2. `w` is `realPortal` or `mockPortal`.
3. Feature state lives on `AuthenticatedApp` and is drilled down.
4. React hooks for academic data, Zustand for theme, TanStack Query for Cloudflare stats.
5. Hash routing for GitHub Pages.
6. PWA from `vite-plugin-pwa`, not a custom `public/sw.js`.
