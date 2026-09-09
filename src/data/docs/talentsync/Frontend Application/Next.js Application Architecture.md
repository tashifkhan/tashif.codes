# Next.js application architecture

## Introduction
This page provides detailed documentation for the Next.js application architecture. It explains the App Router structure, page organization, and component hierarchy. It documents the application layout system, providers setup, and global configuration. It details the build configuration including PWA setup, image optimization, webpack customization, and external package handling. It covers routing patterns, middleware integration, and deployment considerations. It also addresses performance optimization strategies, code splitting, and bundle analysis, along with TypeScript configuration and type safety implementation throughout the application.

## Project structure
The frontend application follows Next.js App Router conventions with a strict file-system-based routing structure under the app directory. Pages are organized by feature and route segments, with nested layouts and providers at the root level. Utility libraries and services are modularized under dedicated folders, while UI components are structured by feature and shared patterns.

Key structural highlights:
- App Router pages under app with nested layouts and providers
- Feature-specific pages grouped under functional namespaces (e.g., dashboard, auth, api)
- Shared UI components under components with feature-specific subfolders
- Services and hooks under services and hooks
- Utilities and types under lib and types
- Global styles and fonts configured at the root layout
- Build-time configuration under next.config.js, tsconfig.json, and related tooling files

```mermaid
graph TB
subgraph "App Router"
LAYOUT["app/layout.tsx"]
LAYOUT_CONTENT["app/layout-content.tsx"]
PROVIDERS["app/providers.tsx"]
HOME["app/page.tsx"]
ERROR["app/error.tsx"]
NOT_FOUND["app/not-found.tsx"]
GLOBAL_ERROR["app/global-error.tsx"]
end
subgraph "Features"
DASHBOARD["app/dashboard/..."]
AUTH["app/auth/..."]
API["app/api/..."]
end
subgraph "Shared"
NAV["lib/navigation.ts"]
UTILS["lib/utils.ts"]
TYPES["types/index.ts"]
end
subgraph "UI"
COMPONENTS["components/..."]
SHARED_UI["components/ui/..."]
end
subgraph "Tooling"
NEXT_CONFIG["next.config.js"]
TS_CONFIG["tsconfig.json"]
TAILWIND["tailwind.config.ts"]
POSTCSS["postcss.config.js"]
MANIFEST["public/manifest.json"]
end
LAYOUT --> LAYOUT_CONTENT
LAYOUT_CONTENT --> PROVIDERS
LAYOUT_CONTENT --> HOME
LAYOUT_CONTENT --> DASHBOARD
LAYOUT_CONTENT --> AUTH
LAYOUT_CONTENT --> API
LAYOUT_CONTENT --> COMPONENTS
LAYOUT_CONTENT --> SHARED_UI
LAYOUT_CONTENT --> NAV
LAYOUT_CONTENT --> UTILS
LAYOUT_CONTENT --> TYPES
NEXT_CONFIG --> TAILWIND
NEXT_CONFIG --> POSTCSS
NEXT_CONFIG --> MANIFEST
```

## Core components
This section outlines the foundational components that define the application's layout, providers, and global configuration.

- Root layout and metadata: Defines application metadata, fonts, and the root HTML wrapper with theme and manifest integration.
- Layout content: Provides the main content area with navigation, sidebar provider, and toast notifications.
- Providers: Wraps the application with session and query providers, configuring caching and retries for data fetching.
- Global error boundaries: Implements error and not-found handlers for graceful degradation and user feedback.
- Tooling configuration: Next.js configuration for PWA, images, webpack, and PostHog proxying; TypeScript strictness and module resolution; Tailwind and PostCSS setup.

Key implementation references:
- Root layout and metadata: `app/layout.tsx`
- Layout content and sidebar provider: `app/layout-content.tsx`
- Providers and React Query configuration: `app/providers.tsx`
- Global error and not-found handlers: `app/error.tsx`, `app/not-found.tsx`, `app/global-error.tsx`
- Next.js configuration: `next.config.js`
- TypeScript configuration: `tsconfig.json`
- Tailwind and PostCSS: `tailwind.config.ts`, `postcss.config.js`
- PWA manifest: `public/manifest.json`

## Architecture overview
The application architecture centers around the Next.js App Router with a layered approach:
- Presentation layer: Root layout, layout content, and feature pages
- State management: Session and query providers for authentication and data fetching
- Routing and middleware: NextAuth middleware for authentication and role-based redirection
- Analytics and observability: PostHog client-side initialization
- Build and deployment: PWA, image optimization, webpack customization, and external packages

```mermaid
graph TB
CLIENT["Browser"]
NEXT["Next.js App Router"]
LAYOUT["Root Layout<br/>app/layout.tsx"]
LAYOUT_CONTENT["Layout Content<br/>app/layout-content.tsx"]
PROVIDERS["Providers<br/>app/providers.tsx"]
NAV["Navigation<br/>lib/navigation.ts"]
AUTH["NextAuth Middleware<br/>proxy.ts"]
AUTH_OPTIONS["Auth Options<br/>lib/auth-options.ts"]
PWA["PWA Config<br/>next.config.js"]
IMAGES["Images Config<br/>next.config.js"]
WEBPACK["Webpack Customization<br/>next.config.js"]
POSTHOG["PostHog Client<br/>instrumentation-client.ts"]
MANIFEST["Manifest<br/>public/manifest.json"]
CLIENT --> NEXT
NEXT --> LAYOUT
LAYOUT --> LAYOUT_CONTENT
LAYOUT_CONTENT --> PROVIDERS
LAYOUT_CONTENT --> NAV
CLIENT --> AUTH
AUTH --> AUTH_OPTIONS
NEXT --> PWA
NEXT --> IMAGES
NEXT --> WEBPACK
CLIENT --> POSTHOG
NEXT --> MANIFEST
```

## Detailed component analysis

### Layout system and providers
The layout system establishes a consistent shell across pages:
- Root layout sets metadata, fonts, theme variables, and mounts the Providers and LayoutContent wrappers.
- LayoutContent manages the main content area, navigation bar, sidebar provider, and toast notifications.
- Providers configure session management and React Query with caching and retry policies.

```mermaid
classDiagram
class RootLayout {
+metadata
+html(lang, className)
+head(meta, manifest)
+body(bg-brand-dark)
+Providers()
+LayoutContent(children)
}
class LayoutContent {
+Navbar()
+SidebarProvider()
+MainLayout(children)
+Toaster()
}
class Providers {
+SessionProvider()
+QueryClientProvider()
+ReactQueryDevtools()
}
RootLayout --> LayoutContent : "wraps"
LayoutContent --> Providers : "contains"
```

### Routing patterns and middleware integration
Routing uses Next.js App Router conventions with dynamic routes and catch-all patterns. Authentication and role-based redirection are handled via NextAuth middleware:
- Dynamic routes: e.g., dashboard pages with slug-based routing
- Catch-all routes: e.g., API namespaces with dynamic segments
- Middleware enforces role selection for authenticated users without roles and redirects accordingly

```mermaid
sequenceDiagram
participant Browser as "Browser"
participant Middleware as "NextAuth Middleware<br/>proxy.ts"
participant NextAuth as "NextAuth<br/>lib/auth-options.ts"
participant Router as "App Router"
Browser->>Middleware : Request page
Middleware->>Middleware : Check token and pathname
alt Has role and on role selection
Middleware-->>Browser : Redirect to dashboard
else No role and not on role selection
Middleware-->>Browser : Redirect to select-role
else Public PostHog proxy
Middleware-->>Browser : Allow request
end
Middleware->>NextAuth : Authorize via authOptions
NextAuth-->>Middleware : Token/session data
Middleware-->>Router : Proceed to requested page
```

### Build configuration and PWA setup
The build configuration integrates PWA capabilities, image optimization, and webpack customization:
- PWA: Enabled via next-pwa with service worker registration and skipWaiting
- Images: Unoptimized mode with remote patterns for avatar providers
- Webpack: Browser-side fixes for Node.js modules and PostHog instrumentation compatibility
- Rewrites: Proxy for PostHog static assets and API requests
- External packages: serverExternalPackages includes @prisma/client and bcrypt

```mermaid
flowchart TD
Start(["Build Start"]) --> PWA["Enable PWA<br/>next-pwa"]
PWA --> Images["Configure Images<br/>unoptimized + remotePatterns"]
Images --> Webpack["Custom Webpack<br/>Node.js fallbacks + replacements"]
Webpack --> Rewrites["Rewrite Rules<br/>PostHog proxy"]
Rewrites --> Externals["External Packages<br/>serverExternalPackages"]
Externals --> End(["Build Complete"])
```

### TypeScript configuration and type safety
TypeScript is configured for strict type checking and modern module resolution:
- Strict mode enabled with noEmit
- Bundler module resolution and isolated modules
- JSX runtime set to react-jsx
- Path aliases (@/*) mapped to root
- Included types for Next.js and generated types

```mermaid
flowchart TD
TS["tsconfig.json"] --> Strict["Strict Mode"]
TS --> Modules["Bundler Resolution"]
TS --> Aliases["@/* alias"]
TS --> Types["Next.js Types"]
Strict --> Safe["Enhanced Type Safety"]
Modules --> ESM["ESM Interop"]
Aliases --> DX["Developer Experience"]
Types --> Autocomplete["IDE Autocomplete"]
```

### UI theme and styling
Tailwind CSS and PostCSS provide a consistent design system:
- Dark mode support with class strategy
- Extended color palette and typography tokens
- Animations and responsive utilities
- Auto-prefixing and Tailwind integration

```mermaid
graph LR
TW["tailwind.config.ts"] --> THEME["Theme Extensions"]
TW --> PLUGINS["Plugins"]
PC["postcss.config.js"] --> TW
THEME --> STYLES["Global Styles"]
PLUGINS --> ANIM["Animations"]
```

### Navigation and UI components
Navigation items and action cards guide users through features:
- Navigation items for desktop and mobile
- Action items for quick feature access
- Shared UI components for forms, dialogs, and interactive elements

```mermaid
classDiagram
class NavItem {
+label : string
+href : string
+icon : LucideIcon
}
class ActionItem {
+description : string
}
NavItem <|-- ActionItem
```

### Error boundaries and user feedback
Error boundaries provide graceful handling of errors and not-found scenarios:
- Page-level error boundary with reset functionality
- Global error boundary for top-level failures
- Not-found page with themed visuals and navigation

```mermaid
sequenceDiagram
participant Router as "App Router"
participant Page as "Current Page"
participant ErrorBoundary as "error.tsx"
participant GlobalError as "global-error.tsx"
participant NotFound as "not-found.tsx"
Router->>Page : Render
Page-->>ErrorBoundary : Throw error
ErrorBoundary-->>Router : Reset or show error UI
Router->>NotFound : 404 route
NotFound-->>Router : Render not-found UI
Router->>GlobalError : Top-level error
GlobalError-->>Router : Render global error UI
```

### Analytics integration
PostHog client-side initialization supports analytics and event tracking:
- Client-side initialization with environment keys
- Proxy configuration for API and static assets
- Trailing slash handling for API compatibility

```mermaid
sequenceDiagram
participant Browser as "Browser"
participant Client as "instrumentation-client.ts"
participant PostHog as "PostHog"
participant Proxy as "next.config.js"
Browser->>Client : Load client script
Client->>PostHog : Initialize with api_host and ui_host
Browser->>Proxy : Request /ph/*
Proxy-->>Browser : Forward to PostHog endpoints
```

## Dependency analysis
The application's dependencies span UI libraries, state management, authentication, analytics, and build tools. The dependency graph highlights core integrations and potential coupling points.

```mermaid
graph TB
subgraph "Runtime"
NEXT["next"]
REACT["react, react-dom"]
NEXT_AUTH["next-auth"]
QUERY["@tanstack/react-query"]
POSTHOG["posthog-js"]
PRISMA["@prisma/client"]
end
subgraph "UI"
RADIX["Radix UI"]
LUCIDE["lucide-react"]
RECHARTS["recharts"]
MOTION["framer-motion"]
end
subgraph "Build"
PWA["next-pwa"]
TAILWIND["tailwindcss"]
AUTOPREFIX["autoprefixer"]
end
NEXT --> REACT
NEXT_AUTH --> PRISMA
QUERY --> REACT
POSTHOG --> REACT
NEXT --> PWA
NEXT --> TAILWIND
NEXT --> AUTOPREFIX
RADIX --> REACT
LUCIDE --> REACT
RECHARTS --> REACT
MOTION --> REACT
```

## Performance considerations
Performance is addressed through several mechanisms:
- Image optimization: Unoptimized images with controlled remote patterns to reduce unnecessary processing
- PWA: Service worker registration and skipWaiting improve offline readiness and load performance
- Webpack customization: Node.js module fallbacks prevent runtime errors and reduce bundle bloat
- React Query caching: Stale-time and retry configurations minimize redundant network requests
- Tailwind purging: Content paths ensure unused styles are removed during build

Recommendations:
- Enable image optimization selectively for performance-sensitive assets
- Monitor bundle sizes and split large components
- Use React Suspense boundaries for data-intensive pages
- Use Next.js static generation where feasible

## Troubleshooting guide
Common issues and resolutions:
- Authentication loops: Verify middleware redirection logic and token presence
- Role selection redirects: Ensure proper handling of authenticated users without roles
- PostHog proxy errors: Confirm rewrite rules and trailing slash configuration
- Image loading issues: Validate remote patterns and asset URLs
- Build errors for Node.js modules: Confirm webpack fallbacks and replacements

Diagnostics:
- Review NextAuth callbacks and session/token updates
- Inspect React Query cache behavior and stale times
- Check PWA registration and service worker lifecycle
- Validate Tailwind content paths and purge behavior

## Conclusion
The Next.js application employs a reliable App Router architecture with strong layout and provider patterns, detailed authentication via NextAuth, and integrated analytics through PostHog. The build configuration emphasizes PWA readiness, controlled image optimization, and webpack customization for compatibility. TypeScript and Tailwind contribute to type safety and maintainable styling. The middleware ensures secure and role-aware routing, while error boundaries provide resilient user experiences.

## Appendices

### Deployment considerations
- Environment variables for authentication and analytics
- PWA manifest and service worker registration
- Build scripts invoking Prisma generation and migrations
- Docker and compose configurations for containerized deployment
