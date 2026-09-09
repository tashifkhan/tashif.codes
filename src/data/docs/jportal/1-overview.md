# Overview

## Purpose and scope

This page introduces JPortal, a Progressive Web Application (PWA) that is a modern replacement for the JIIT Web Portal. It covers the application's purpose, key features, technology stack, and high-level architecture.

For detailed setup and deployment instructions, see [Getting Started](2-getting-started). For in-depth architecture discussions, see [Architecture Overview](3-architecture-overview). For information about individual features, see [Feature Modules](4-feature-modules).

## What is JPortal

JPortal is a client-side Progressive Web App designed to provide JIIT students with an improved interface for accessing academic information. Unlike the official JIIT Web Portal, JPortal offers:

* **No CAPTCHA authentication** - Uses the `jsjiit` library to bypass CAPTCHA requirements
* **Modern UI** - Built with React and Radix UI primitives
* **Offline capability** - PWA features enable offline access
* **Customizable themes** - Extensive theming system with 15+ presets
* **Demo mode** - Test the application without credentials using mock data
* **Cross-platform** - Installable on Android, iOS, and Windows

The application is hosted on GitHub Pages at `https://codeblech.github.io/jportal` and deployed automatically via GitHub Actions.

## Key features

JPortal provides five primary feature modules accessible to authenticated users:

| Feature | Description | Key Functionality |
| --- | --- | --- |
| **Attendance** | Class attendance tracking | Overview/daily tabs, attendance goals, subject-level details, attendance prediction |
| **Grades** | Academic performance | SGPA/CGPA trends, grade cards, marks with PDF parsing |
| **Exams** | Examination schedules | Semester/event selection, schedule display |
| **Subjects** | Registered courses | Course information, credits, faculty details |
| **Profile** | Student information | Personal, academic, contact, family, and address data |
| **Analytics** | Usage statistics | Cloudflare analytics dashboard (public access) |

### Authentication modes

The application supports two authentication modes, managed through the `App` component:

1. **Real Mode** - Authenticates against the official JIIT Web Portal using the `WebPortal` class from `jsjiit` library
2. **Demo Mode** - Uses `MockWebPortal` with static data from `fakedata.json` for testing and demonstration

## Technology stack

### Core framework

![Diagram 1](images/1-overview_diagram_1.png)

**Key Dependencies Table**

| Category | Package | Version | Purpose |
| --- | --- | --- | --- |
| Authentication | `jsjiit` | 0.0.20 | JIIT Web Portal API client (CDN) |
| Forms | `react-hook-form` | 7.53.1 | Form state management |
| Validation | `zod` | 3.23.8 | Schema validation |
| Date Handling | `date-fns` | 3.6.0 | Date manipulation |
| Toast Notifications | `sonner` | 2.0.7 | Toast notifications |
| PDF Parsing | Pyodide + PyMuPDF | - | Client-side PDF processing |

## High-Level architecture

### Application entry point and authentication flow

![Diagram 2](images/1-overview_diagram_2.png)

The `App` component ([App.jsx243-376](https://github.com/codeblech/jportal/blob/4df0fde4/App.jsx#L243-L376)) is the authentication gatekeeper:

1. On mount, attempts auto-login using stored credentials via `localStorage` ([App.jsx252-288](https://github.com/codeblech/jportal/blob/4df0fde4/App.jsx#L252-L288))
2. Renders `LoginWrapper` for unauthenticated users
3. Renders `AuthenticatedApp` for authenticated users
4. Passes the appropriate portal instance (`realPortal` or `mockPortal`) as the `w` prop

### Feature module organization

![Diagram 3](images/1-overview_diagram_3.png)

The `AuthenticatedApp` component manages all authenticated routes and is a central state hub. It maintains separate state slices for each feature module and passes them down via props (props drilling pattern). Each feature component receives:

* The `w` prop (portal instance)
* State variables specific to that feature
* State setter functions
* Shared UI state (loading, error states)

## Application data flow

### Portal abstraction layer

The application uses a **strategy pattern** for data access, allowing smooth switching between real and demo modes:

![Diagram 4](images/1-overview_diagram_4.png)

All feature components interact with the portal through a uniform interface, calling methods like:

* `w.get_attendance()`
* `w.get_grades()`
* `w.get_exam_events()`
* `w.get_registered_subjects()`
* `w.get_student_info()`

This abstraction enables offline development and testing while maintaining production compatibility.

### State persistence

State persistence is handled through multiple mechanisms:

| Data Type | Storage Method | Location in Code |
| --- | --- | --- |
| Credentials | `localStorage` (username, password) | [jportal/src/components/Login.jsx54-55](https://github.com/codeblech/jportal/blob/4df0fde4/jportal/src/components/Login.jsx#L54-L55) |
| Attendance Goal | `localStorage` | [jportal/src/App.jsx53-61](https://github.com/codeblech/jportal/blob/4df0fde4/jportal/src/App.jsx#L53-L61) |
| Theme Configuration | Zustand store (persisted) | Theme system components |
| API Response Cache | Component state | Feature module state variables |

## PWA architecture

JPortal is configured as a Progressive Web App using the VitePWA plugin:

### Service worker and caching strategy

The application implements offline-first capabilities through:

1. **Static Asset Caching** - HTML, CSS, JS, and images
2. **Pyodide Runtime Caching** - Python runtime and wheel files for PDF parsing
3. **Manifest Configuration** - App metadata, icons, and theme colors

### Installation targets

| Platform | Installation Method |
| --- | --- |
| Android (Chromium) | "Add to Home Screen" → "Install" |
| iOS (Safari) | Share button → "Add to Home Screen" |
| Windows | Install icon in URL bar |

The PWA configuration enables JPortal to function as a standalone application without requiring app store distribution.

## Theme system overview

JPortal features an advanced theming system with:

* **15+ predefined theme presets** - Defined in `theme-presets.ts`
* **Light/Dark mode support** - Toggle with view transition animations
* **Dynamic font loading** - Google Fonts loaded on theme change
* **CSS custom properties** - Theme values mapped to Tailwind utilities
* **Zustand state management** - Global theme state persistence

The theme system integrates throughout the application via the `ThemeProvider`, `ThemeSelector`, and `DynamicFontLoader` components. For detailed theme architecture, see [Theme System](3.4-theme-system).

## Navigation structure

The application uses React Router DOM with hash-based routing (`HashRouter`):

### Public routes

* `/stats` - Cloudflare Analytics Dashboard (no authentication required)

### Protected routes (require authentication)

* `/` - Redirects to `/attendance`
* `/attendance` - Attendance tracking
* `/grades` - Academic performance
* `/exams` - Examination schedules
* `/subjects` - Registered courses
* `/profile` - Student information

Navigation is provided through:

* **Header** - Theme selector, logout button (top of screen)
* **Navbar** - Bottom navigation with 5 route links

## Getting started

To begin using or developing JPortal:

* For installation and setup instructions, see [Getting Started](2-getting-started)
* For detailed architecture information, see [Architecture Overview](3-architecture-overview)
* For information about specific features, see [Feature Modules](4-feature-modules)
* For UI component documentation, see [UI Components](5-ui-components)
* For build and deployment processes, see [Build & Deployment](6-build-and-deployment)
* For development guidelines, see [Development Guide](7-development-guide)
