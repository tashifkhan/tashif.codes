# Frontend architecture

## Introduction
This page describes the frontend architecture of the Next.js application. It focuses on the app router-based structure, page composition, provider pattern for state management, authentication, and data fetching. It also covers TypeScript configuration, build and deployment setup, UI framework integration with Tailwind CSS and Radix UI, SSR/SSG capabilities, performance optimization strategies, responsive design patterns, backend API integration, error handling, and loading states.

## Project structure
The frontend follows Next.js app router conventions with a strict file-system-based routing and a layered provider pattern. The root layout composes a global stylesheet, fonts, and a Providers wrapper that exposes session and query client contexts. Pages under app define the top-level routes, while reusable UI components live under components. Services encapsulate API communication, and utilities centralize shared logic.

```mermaid
graph TB
A["app/layout.tsx"] --> B["app/providers.tsx"]
A --> C["app/layout-content.tsx"]
C --> D["components/navbar.tsx"]
C --> E["components/ui/toaster.tsx"]
B --> F["next-auth/react SessionProvider"]
B --> G["@tanstack/react-query QueryClientProvider"]
H["app/page.tsx"] --> I["components/landing-hero.tsx"]
H --> J["components/landing/*"]
```

## Core components
- Root layout: Defines metadata, fonts, PWA manifest, and wraps children with Providers and LayoutContent.
- Providers: Initializes NextAuth session provider and React Query client with caching and retry policies.
- Layout content: Renders Navbar, main content area with dynamic sidebar padding, and global Toaster.
- Global styles: Tailwind base/components/utilities plus CSS variables for theme tokens and responsive utilities.
- Navigation: Typed navigation items and icons for desktop and mobile layouts.
- UI primitives: Radix UI-based components (e.g., Button) with Tailwind variants and class variance authority.

## Architecture overview
The application uses a layered provider pattern:
- Authentication: next-auth/react session provider supplies JWT-based sessions and user data.
- Data fetching: React Query manages server state, caching, retries, and background refetch policies.
- UI: Tailwind CSS and Radix UI components form a cohesive design system with theme tokens and animations.
- Routing: App router pages and nested groups organize feature areas and API routes.

```mermaid
graph TB
subgraph "App Shell"
L["app/layout.tsx"]
LC["app/layout-content.tsx"]
P["app/providers.tsx"]
end
subgraph "Providers"
S["next-auth SessionProvider"]
Q["react-query QueryClientProvider"]
end
subgraph "Pages"
HP["app/page.tsx"]
end
subgraph "UI Layer"
T["Tailwind CSS"]
R["Radix UI"]
end
L --> P
L --> LC
P --> S
P --> Q
LC --> HP
HP --> T
HP --> R
```

## Detailed component analysis

### Provider pattern: authentication and data fetching
The Providers component initializes:
- SessionProvider for NextAuth, enabling client-side session reads and updates.
- QueryClient with a defaultOptions configuration:
  - Stale time of 1 minute.
  - Retry attempts set to 2.
  - Disables refetch on window focus to reduce unnecessary network activity.

```mermaid
sequenceDiagram
participant Browser as "Browser"
participant Layout as "RootLayout"
participant Providers as "Providers"
participant Session as "SessionProvider"
participant Query as "QueryClientProvider"
Browser->>Layout : Render app
Layout->>Providers : Wrap children
Providers->>Session : Initialize
Providers->>Query : Initialize QueryClient
Providers-->>Layout : Render children
```

### Authentication: NextAuth options and callbacks
Authentication is configured via next-auth with:
- Multiple providers: credentials, Google, GitHub, Email.
- Prisma adapter for user persistence.
- Session strategy: JWT.
- Callbacks:
  - signIn: Verifies email for credentials, auto-verifies OAuth users, ensures profile image propagation.
  - session: Injects user id and role into session.
  - jwt: Refreshes token payload with latest user role and image.
- Events:
  - createUser: Marks OAuth users as verified.

```mermaid
flowchart TD
Start(["Sign-in Attempt"]) --> CheckProvider["Determine Provider"]
CheckProvider --> OAuth{"OAuth Provider?"}
OAuth --> |Yes| VerifyOAuth["Ensure verified=true<br/>and image propagated"]
OAuth --> |No| Credentials{"Credentials Provider?"}
Credentials --> |Yes| CheckEmail["Check email verification"]
CheckEmail --> Verified{"Verified?"}
Verified --> |No| RedirectVerify["Redirect to verify-email"]
Verified --> |Yes| Proceed["Proceed to session/jwt callbacks"]
Credentials --> |No| Proceed
VerifyOAuth --> Proceed
Proceed --> SessionCB["session callback sets id/role/image"]
SessionCB --> JWTCB["jwt callback refreshes role/image"]
JWTCB --> Done(["Authenticated"])
```

### Data fetching: React query defaults and devtools
React Query is configured with:
- StaleTime: 1 minute to balance freshness and performance.
- Retry: Up to two attempts on failure.
- RefetchOnWindowFocus: Disabled to avoid excessive background refetches.
- Devtools: Conditionally enabled in development.

```mermaid
flowchart TD
Init(["Initialize QueryClient"]) --> SetDefaults["Set defaultOptions"]
SetDefaults --> Stale["staleTime = 1 min"]
SetDefaults --> Retry["retry = 2"]
SetDefaults --> Refocus["refetchOnWindowFocus = false"]
SetDefaults --> Devtools["ReactQueryDevtools (initialIsOpen=false)"]
```

### API client: request abstraction and error handling
The apiClient module provides a typed HTTP client:
- Methods: get, post, put, patch, delete.
- Automatic query string building and JSON serialization for non-FormData bodies.
- Unified error handling:
  - Parses error messages from response data (message, detail, error).
  - Throws ApiError with status and parsed message.
  - Wraps network errors into ApiError with status 500.

```mermaid
sequenceDiagram
participant Caller as "Component/Service"
participant Api as "apiClient"
participant Fetch as "fetch()"
participant Server as "Backend API"
Caller->>Api : apiClient.post(url, body, options)
Api->>Fetch : fetch(fullUrl, config)
Fetch-->>Api : Response
Api->>Api : Parse JSON
Api->>Api : Check response.ok
alt Success
Api-->>Caller : data
else Failure
Api->>Api : Build error message from data
Api-->>Caller : throw ApiError(status, message, data)
end
```

### UI framework: Tailwind CSS and radix UI
- Tailwind configuration:
  - Dark mode via class strategy.
  - Theme extension with semantic color tokens, brand colors, and animations.
  - Font families bound to CSS variables from next/font/google.
- Radix UI primitives:
  - Button component uses class-variance-authority for variants and sizes.
  - Consistent design tokens and motion through Tailwind classes.

```mermaid
classDiagram
class Button {
+variant : "default|destructive|outline|secondary|ghost|link"
+size : "default|sm|lg|icon"
+asChild : boolean
}
```

### Navigation and layout composition
- Navigation items and icons are centralized for desktop and mobile views.
- LayoutContent manages sidebar collapse state and adjusts main content padding responsively.
- Global styles define theme tokens and responsive utilities for safe areas and mobile navigation spacing.

```mermaid
graph LR
Nav["lib/navigation.ts"] --> Layout["app/layout-content.tsx"]
Layout --> Main["Responsive main padding"]
Styles["app/globals.css"] --> Main
```

### Shared utilities and services
- Prisma client initialization with global singleton pattern for development isolation.
- Toast manager with reducer-based state, timeouts, and dismissal logic for user feedback.

```mermaid
flowchart TD
Start(["useToast hook"]) --> State["Reducer state: toasts[]"]
State --> Add["ADD_TOAST"]
State --> Update["UPDATE_TOAST"]
State --> Dismiss["DISMISS_TOAST"]
State --> Remove["REMOVE_TOAST"]
Dismiss --> Queue["Schedule removal timeout"]
Remove --> Clear["Clear toasts"]
```

## Dependency analysis
Key external dependencies and integrations:
- next-pwa: Enables PWA features with service worker registration and skipWaiting.
- next.config.js: Image optimization settings, webpack fixes for PostHog, and rewrites for analytics.
- next-font-google: Font variables injected into CSS variables for Tailwind usage.
- next-auth: Authentication with Prisma adapter and multiple providers.
- @tanstack/react-query: Centralized caching and retry logic for API data.
- Tailwind CSS: Utility-first CSS with theme tokens and animations.
- Radix UI: Accessible UI primitives integrated with Tailwind variants.

```mermaid
graph TB
NQ["next.config.js"] --> PWA["next-pwa"]
NQ --> Images["images.unoptimized + remotePatterns"]
NQ --> WebpackFix["Webpack aliases/fallbacks for PostHog"]
NQ --> Rewrites["Rewrite /ph/* to PostHog EU endpoints"]
TS["tsconfig.json"] --> Bundler["moduleResolution: bundler"]
TS --> Paths["@/* -> ./*"]
TW["tailwind.config.ts"] --> Tokens["Theme tokens + animations"]
TW --> Fonts["Font families via CSS vars"]
NA["lib/auth-options.ts"] --> NA_DB["@next-auth/prisma-adapter"]
NA --> BCrypt["bcrypt compare"]
PRISMA["lib/prisma.ts"] --> NA_DB
QC["app/providers.tsx"] --> RQ["@tanstack/react-query"]
RQ --> Devtools["ReactQueryDevtools"]
```

## Performance considerations
- React Query defaults:
  - StaleTime reduces redundant network calls.
  - Retry improves resilience without manual intervention.
  - Disabling refetchOnWindowFocus minimizes background traffic.
- PWA:
  - Service worker registration and skipWaiting improve offline readiness and update behavior.
- Image optimization:
  - Remote patterns for trusted avatars; unoptimized images to avoid extra processing overhead.
- Webpack fixes:
  - Aliases and replacements prevent PostHog Node APIs from bundling in the browser.
- Tailwind:
  - CSS variables and theme tokens enable efficient runtime switching and minimal CSS output.
- Build configuration:
  - Bundler module resolution and incremental compilation optimize rebuild times.

[No sources needed since this section provides general guidance]

## Troubleshooting guide
- Authentication:
  - Ensure NEXTAUTH_SECRET and provider credentials are set in environment variables.
  - Verify Prisma adapter connection and user records.
  - Check signIn callback logic for email verification and OAuth image propagation.
- API client:
  - Inspect ApiError thrown on non-OK responses; review message/detail/error fields.
  - Confirm request body serialization and Content-Type handling for FormData vs JSON.
- React Query:
  - Adjust staleTime/retry based on data volatility.
  - Use ReactQueryDevtools to inspect cache state and refetch triggers.
- Navigation and layout:
  - Validate navigation items and icons; ensure responsive padding adapts to sidebar collapse.
- Styling:
  - Confirm Tailwind content globs include all component paths.
  - Verify CSS variables for theme tokens are present in:root and.dark.

## Conclusion
The frontend uses Next.js app router for structured routing, a reliable provider pattern for authentication and data fetching, and a cohesive UI system powered by Tailwind CSS and Radix UI. The configuration emphasizes performance, developer experience, and maintainability through React Query defaults, PWA support, and a strongly typed TypeScript setup. The architecture supports scalable feature growth while preserving responsive design and consistent theming.
