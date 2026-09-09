# Architecture overview

## Purpose and scope

This page describes the high-level architecture of JPortal, including the technology stack, application structure, component organization, routing system, and key design patterns. For detailed information about specific subsystems, refer to:

* Authentication flow and routing: [Application Structure & Authentication](3.1-application-structure-and-authentication)
* State management patterns: [State Management Strategy](3.2-state-management-strategy)
* Data access layer: [Data Layer & API Integration](3.3-data-layer-and-api-integration)
* Theme infrastructure: [Theme System](3.4-theme-system)
* Individual feature modules: [Feature Modules](4-feature-modules)

## Technology stack

JPortal is built as a single-page application (SPA) using modern web technologies:

| Category | Technologies | Purpose |
| --- | --- | --- |
| **Frontend Framework** | React 18.3.1 | UI component library and rendering |
| **Build Tool** | Vite 5.4.10 | Development server and production bundler |
| **Routing** | React Router DOM 6.27.0 | Client-side navigation with `HashRouter` |
| **UI Components** | Radix UI primitives | Accessible, unstyled component primitives |
| **Styling** | Tailwind CSS 4.1.12, Class Variance Authority | Utility-first CSS framework with component variants |
| **State Management** | React hooks (useState, useEffect), Zustand 5.0.8 | Local state + global theme store |
| **Forms** | React Hook Form 7.53.1, Zod 3.23.8 | Form handling and validation |
| **Data Visualization** | Recharts 2.15.4 | Charts for grades and analytics |
| **Server State** | TanStack Query 5.90.2 | Available but minimally used |
| **PWA** | VitePWA Plugin 0.20.5, Workbox | Offline capabilities and installability |
| **External APIs** | jsjiit 0.0.20 (CDN), Pyodide 0.23.4 | JIIT portal integration, Python in browser |

## Application entry point and bootstrap

### HTML and script loading

The application bootstraps from `index.html`, which defines critical resources:

![Diagram 1](images/3-architecture-overview_diagram_1.png)

### Main entry point

The `main.jsx` file renders the root `App` component into the DOM:

![Diagram 2](images/3-architecture-overview_diagram_2.png)

## Application architecture

### Top-Level component structure

The `App` component is the authentication gatekeeper and application shell:

![Diagram 3](images/3-architecture-overview_diagram_3.png)

**Key State Variables in App:**

* `isAuthenticated`: Boolean indicating user authentication status
* `isDemoMode`: Boolean determining whether to use `mockPortal` or `realPortal`
* `isLoading`: Boolean for auto-login attempt on mount
* `error`: String for displaying login errors

### Portal instance management

Two portal instances are created at the module level and conditionally passed to child components:

![Diagram 4](images/3-architecture-overview_diagram_4.png)

## Routing architecture

### Route structure

JPortal uses `HashRouter` for client-side routing with route guards based on authentication:

![Diagram 5](images/3-architecture-overview_diagram_5.png)

### AuthenticatedApp internal routing

The `AuthenticatedApp` component defines protected routes and provides global UI chrome:

![Diagram 6](images/3-architecture-overview_diagram_6.png)

## State management architecture

### State hierarchy

JPortal implements a hierarchical state management pattern with extensive props drilling:

![Diagram 7](images/3-architecture-overview_diagram_7.png)

**State Persistence:**

* `attendanceGoal`: Saved to `localStorage` with default value of 75
* Login credentials: Stored in `localStorage` for auto-login

### State flow to feature components

All feature states are passed as props to their respective components:

![Diagram 8](images/3-architecture-overview_diagram_8.png)

## Data access layer: portal abstraction

### Portal strategy pattern

The application uses a strategy pattern through the `w` prop to abstract data access:

![Diagram 9](images/3-architecture-overview_diagram_9.png)

**Common Portal Methods:**

* `student_login(username, password)`
* `get_attendance(stud_id, sem_id)`
* `get_grades()`
* `get_subject_faculty(stud_id, sem_id)`
* `get_exam_schedule()`
* `get_header()`
* `get_exam_events()`
* Additional methods for marks and grade cards

### Login flow

![Diagram 10](images/3-architecture-overview_diagram_10.png)

**Auto-Login on Mount:**
The `App` component attempts auto-login using stored credentials in `localStorage`:

## Theme infrastructure

### Theme state management with zustand

The theme system uses Zustand for global state, separate from React component state:

![Diagram 11](images/3-architecture-overview_diagram_11.png)

### Dynamic font loading

The `DynamicFontLoader` component monitors theme changes and loads Google Fonts dynamically:

![Diagram 12](images/3-architecture-overview_diagram_12.png)

**Key Functions:**

* `extractFontFamily(fontFamilyValue)`: Parses CSS font-family string, filters out system fonts
* `buildFontCssUrl(family, weights)`: Constructs Google Fonts API URL
* `loadGoogleFont(family, weights)`: Injects `<link>` element into document head

**Default Font Weights:** `["400", "500", "600", "700"]`

## Component architecture patterns

### Feature module pattern

All feature modules follow a consistent pattern:

| Aspect | Implementation |
| --- | --- |
| **Props Interface** | Receive `w` (portal), state variables, and setters from `AuthenticatedApp` |
| **Data Fetching** | Call `w.method()` in `useEffect` hooks |
| **State Updates** | Use setter props to update parent state |
| **Caching** | Store fetched data in parent state to avoid re-fetching |
| **Loading States** | Manage via boolean state variables (e.g., `gradesLoading`) |
| **Error Handling** | Try/catch blocks with error state variables |

**Example: Attendance Component Props**

```
w, attendanceData, setAttendanceData, semestersData, setSemestersData,
selectedSem, setSelectedSem, attendanceGoal, setAttendanceGoal,
subjectAttendanceData, setSubjectAttendanceData, selectedSubject,
setSelectedSubject, isAttendanceMetaLoading, setIsAttendanceMetaLoading,
isAttendanceDataLoading, setIsAttendanceDataLoading, activeTab,
setActiveTab, dailyDate, setDailyDate, calendarOpen, setCalendarOpen,
isTrackerOpen, setIsTrackerOpen, subjectCacheStatus, setSubjectCacheStatus
```

### Global UI components

![Diagram 13](images/3-architecture-overview_diagram_13.png)

The `Header` component handles theme switching and logout. The `Navbar` provides bottom navigation to feature routes.

## External service integration

### Service dependencies

![Diagram 14](images/3-architecture-overview_diagram_14.png)

**jsjiit Library Usage:**

* Imported via CDN: `https://cdn.jsdelivr.net/npm/jsjiit@0.0.20/dist/jsjiit.esm.js`
* Provides `WebPortal` class and `LoginError` exception
* Handles authentication and data retrieval from JIIT portal

**Pyodide Usage:**

* Loaded from CDN in `index.html`
* Used in Grades module for parsing marks PDFs with PyMuPDF
* Enables client-side Python execution

## Error handling and loading states

### Authentication error handling

![Diagram 15](images/3-architecture-overview_diagram_15.png)

**Error States:**

* App-level `error` state for auto-login failures
* Feature-level error states (e.g., `gradesError`)
* Toast notifications via `sonner` library

## Summary

JPortal's architecture is characterized by:

1. **Authentication-first design**: The `App` component acts as a gatekeeper, controlling access to all features
2. **Portal abstraction**: The `w` prop provides a clean interface to switch between real and demo data sources
3. **Props drilling pattern**: All state is lifted to `AuthenticatedApp`, then passed down to feature modules
4. **Hybrid state management**: React hooks for feature state, Zustand for theme, TanStack Query available but underutilized
5. **Component composition**: Radix UI primitives composed into custom feature components
6. **Hash-based routing**: Client-side routing without server configuration requirements
7. **Progressive enhancement**: PWA features, offline caching, installability
8. **External service integration**: Smooth integration with jsjiit, Pyodide, and Cloudflare services

This architecture supports rapid feature development through consistent patterns while maintaining separation of concerns between authentication, data access, and presentation layers.
