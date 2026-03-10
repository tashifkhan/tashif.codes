# Side Panel UI Components

<cite>
**Referenced Files in This Document**
- [App.tsx](file://extension/entrypoints/sidepanel/App.tsx)
- [UnifiedSettingsMenu.tsx](file://extension/entrypoints/sidepanel/components/UnifiedSettingsMenu.tsx)
- [ProfileSidebar.tsx](file://extension/entrypoints/sidepanel/components/ProfileSidebar.tsx)
- [ResponseSection.tsx](file://extension/entrypoints/sidepanel/components/ResponseSection.tsx)
- [LoadingScreen.tsx](file://extension/entrypoints/sidepanel/components/LoadingScreen.tsx)
- [SignInScreen.tsx](file://extension/entrypoints/sidepanel/components/SignInScreen.tsx)
- [CuteTextInput.tsx](file://extension/entrypoints/sidepanel/components/CuteTextInput.tsx)
- [ApiKeySection.tsx](file://extension/entrypoints/sidepanel/components/ApiKeySection.tsx)
- [SettingsSection.tsx](file://extension/entrypoints/sidepanel/components/SettingsSection.tsx)
- [WebSocketStatus.tsx](file://extension/entrypoints/sidepanel/components/WebSocketStatus.tsx)
- [select.tsx](file://extension/entrypoints/sidepanel/components/ui/select.tsx)
- [useAuth.ts](file://extension/entrypoints/sidepanel/hooks/useAuth.ts)
- [useTabManagement.ts](file://extension/entrypoints/sidepanel/hooks/useTabManagement.ts)
- [useWebSocket.ts](file://extension/entrypoints/sidepanel/hooks/useWebSocket.ts)
- [App.css](file://extension/entrypoints/sidepanel/App.css)
- [index.html](file://extension/entrypoints/sidepanel/index.html)
- [main.tsx](file://extension/entrypoints/sidepanel/main.tsx)
</cite>

## Table of Contents
1. [Introduction](#introduction)
2. [Project Structure](#project-structure)
3. [Core Components](#core-components)
4. [Architecture Overview](#architecture-overview)
5. [Detailed Component Analysis](#detailed-component-analysis)
6. [Dependency Analysis](#dependency-analysis)
7. [Performance Considerations](#performance-considerations)
8. [Troubleshooting Guide](#troubleshooting-guide)
9. [Conclusion](#conclusion)

## Introduction
This document provides comprehensive documentation for the Side Panel UI Components of the Agentic Browser extension. It focuses on the main App.tsx component structure, state management, and component composition patterns. It details the UnifiedSettingsMenu for configuration management, ProfileSidebar for user information display, ResponseSection for showing agent responses, and LoadingScreen for user feedback. The guide explains component hierarchy, prop passing, state synchronization, and styling approaches. It includes examples of component usage, customization options, and responsive design considerations. It also documents the integration with React hooks for authentication, tab management, and WebSocket communication, along with accessibility features, cross-browser styling compatibility, and performance optimization strategies.

## Project Structure
The Side Panel UI resides under the extension entrypoint sidepanel and follows a feature-based organization:
- App.tsx orchestrates authentication, tab management, WebSocket integration, and renders the primary UI.
- Components are grouped under components/ with reusable UI primitives under components/ui/.
- Hooks encapsulate cross-cutting concerns: authentication, tab management, and WebSocket connectivity.
- Styling is centralized in App.css with global fonts loaded via index.html.

```mermaid
graph TB
subgraph "Side Panel Entry"
HTML["index.html"]
MAIN["main.tsx"]
APP["App.tsx"]
end
subgraph "Components"
SETTINGS["UnifiedSettingsMenu.tsx"]
PROFILE["ProfileSidebar.tsx"]
RESPONSE["ResponseSection.tsx"]
LOADING["LoadingScreen.tsx"]
SIGNIN["SignInScreen.tsx"]
INPUT["CuteTextInput.tsx"]
APIKEY["ApiKeySection.tsx"]
SETTINGSSHORT["SettingsSection.tsx"]
WSSTATUS["WebSocketStatus.tsx"]
SELECT["ui/select.tsx"]
end
subgraph "Hooks"
AUTH["useAuth.ts"]
TABS["useTabManagement.ts"]
WS["useWebSocket.ts"]
end
subgraph "Styling"
CSS["App.css"]
end
HTML --> MAIN --> APP
APP --> AUTH
APP --> TABS
APP --> WS
APP --> SETTINGS
APP --> PROFILE
APP --> RESPONSE
APP --> LOADING
APP --> SIGNIN
SETTINGS --> INPUT
SETTINGS --> APIKEY
SETTINGS --> SETTINGSSHORT
SETTINGS --> WSSTATUS
SETTINGS --> SELECT
PROFILE --> INPUT
RESPONSE --> INPUT
SIGNIN --> INPUT
APP --> CSS
```

**Diagram sources**
- [index.html](file://extension/entrypoints/sidepanel/index.html#L1-L20)
- [main.tsx](file://extension/entrypoints/sidepanel/main.tsx#L1-L10)
- [App.tsx](file://extension/entrypoints/sidepanel/App.tsx#L1-L200)
- [UnifiedSettingsMenu.tsx](file://extension/entrypoints/sidepanel/components/UnifiedSettingsMenu.tsx#L1-L1194)
- [ProfileSidebar.tsx](file://extension/entrypoints/sidepanel/components/ProfileSidebar.tsx#L1-L326)
- [ResponseSection.tsx](file://extension/entrypoints/sidepanel/components/ResponseSection.tsx#L1-L15)
- [LoadingScreen.tsx](file://extension/entrypoints/sidepanel/components/LoadingScreen.tsx#L1-L18)
- [SignInScreen.tsx](file://extension/entrypoints/sidepanel/components/SignInScreen.tsx#L1-L414)
- [CuteTextInput.tsx](file://extension/entrypoints/sidepanel/components/CuteTextInput.tsx#L1-L81)
- [ApiKeySection.tsx](file://extension/entrypoints/sidepanel/components/ApiKeySection.tsx#L1-L25)
- [SettingsSection.tsx](file://extension/entrypoints/sidepanel/components/SettingsSection.tsx#L1-L111)
- [WebSocketStatus.tsx](file://extension/entrypoints/sidepanel/components/WebSocketStatus.tsx#L1-L36)
- [select.tsx](file://extension/entrypoints/sidepanel/components/ui/select.tsx#L1-L186)
- [useAuth.ts](file://extension/entrypoints/sidepanel/hooks/useAuth.ts#L1-L311)
- [useTabManagement.ts](file://extension/entrypoints/sidepanel/hooks/useTabManagement.ts#L1-L94)
- [useWebSocket.ts](file://extension/entrypoints/sidepanel/hooks/useWebSocket.ts#L1-L49)
- [App.css](file://extension/entrypoints/sidepanel/App.css#L1-L349)

**Section sources**
- [index.html](file://extension/entrypoints/sidepanel/index.html#L1-L20)
- [main.tsx](file://extension/entrypoints/sidepanel/main.tsx#L1-L10)
- [App.tsx](file://extension/entrypoints/sidepanel/App.tsx#L1-L200)
- [App.css](file://extension/entrypoints/sidepanel/App.css#L1-L349)

## Core Components
This section outlines the primary UI components and their responsibilities:
- UnifiedSettingsMenu: Centralized configuration hub supporting profile, credentials, API keys, base URL, WebSocket preferences, and connection status.
- ProfileSidebar: Displays user profile details, token information, and actions for manual refresh/logout.
- ResponseSection: Renders agent responses in a scrollable container.
- LoadingScreen: Minimal loading interface while authentication resolves.
- SignInScreen: Onboarding screen with OAuth options and animated branding.
- CuteTextInput: Styled input with focus animations and Enter submission support.
- SettingsSection and WebSocketStatus: Compact settings and connection toggles.
- select.tsx: Reusable Radix UI-based Select primitive set.

Key integration points:
- App.tsx manages global state (authentication, tab info, API key, WebSocket connection, conversation stats) and passes props to child components.
- Hooks encapsulate browser APIs and external services (OAuth, tabs, WebSocket client).
- Styling leverages CSS modules and global styles for consistent theming.

**Section sources**
- [App.tsx](file://extension/entrypoints/sidepanel/App.tsx#L1-L200)
- [UnifiedSettingsMenu.tsx](file://extension/entrypoints/sidepanel/components/UnifiedSettingsMenu.tsx#L1-L1194)
- [ProfileSidebar.tsx](file://extension/entrypoints/sidepanel/components/ProfileSidebar.tsx#L1-L326)
- [ResponseSection.tsx](file://extension/entrypoints/sidepanel/components/ResponseSection.tsx#L1-L15)
- [LoadingScreen.tsx](file://extension/entrypoints/sidepanel/components/LoadingScreen.tsx#L1-L18)
- [SignInScreen.tsx](file://extension/entrypoints/sidepanel/components/SignInScreen.tsx#L1-L414)
- [CuteTextInput.tsx](file://extension/entrypoints/sidepanel/components/CuteTextInput.tsx#L1-L81)
- [SettingsSection.tsx](file://extension/entrypoints/sidepanel/components/SettingsSection.tsx#L1-L111)
- [WebSocketStatus.tsx](file://extension/entrypoints/sidepanel/components/WebSocketStatus.tsx#L1-L36)
- [select.tsx](file://extension/entrypoints/sidepanel/components/ui/select.tsx#L1-L186)

## Architecture Overview
The Side Panel UI follows a unidirectional data flow:
- App.tsx initializes hooks and state, then conditionally renders either LoadingScreen, SignInScreen, or the main UI with AgentExecutor and settings/profile panels.
- Hooks manage browser-specific integrations (storage, tabs, identity, WebSocket).
- Components receive props and trigger updates via callbacks, ensuring predictable state transitions.

```mermaid
sequenceDiagram
participant User as "User"
participant App as "App.tsx"
participant Auth as "useAuth.ts"
participant Tabs as "useTabManagement.ts"
participant WS as "useWebSocket.ts"
User->>App : Launch Side Panel
App->>Auth : Initialize authentication
Auth-->>App : user, authLoading, tokenStatus
App->>Tabs : Initialize tab management
Tabs-->>App : activeTab
App->>WS : Setup WebSocket
WS-->>App : wsConnected, useWebSocket
App->>App : Render UI based on auth state
App-->>User : UnifiedSettingsMenu / ProfileSidebar / ResponseSection
```

**Diagram sources**
- [App.tsx](file://extension/entrypoints/sidepanel/App.tsx#L1-L200)
- [useAuth.ts](file://extension/entrypoints/sidepanel/hooks/useAuth.ts#L1-L311)
- [useTabManagement.ts](file://extension/entrypoints/sidepanel/hooks/useTabManagement.ts#L1-L94)
- [useWebSocket.ts](file://extension/entrypoints/sidepanel/hooks/useWebSocket.ts#L1-L49)

## Detailed Component Analysis

### App.tsx: Orchestrator and State Hub
Responsibilities:
- Authentication lifecycle: initialize, refresh tokens, handle login/logout.
- Tab management: track active tab and update on changes.
- WebSocket integration: connect/disconnect, listen to events, update response state.
- Conversation statistics: fetch via WebSocket client or HTTP fallback.
- UI routing: render LoadingScreen, SignInScreen, or main app with settings/profile panels.

State and effects:
- Manages local state for API key, response, token visibility, conversation stats, and settings panel open state.
- Subscribes to browser storage changes for API key updates.
- Sends messages to background script to activate/deactivate AI frame.

Propagation pattern:
- Passes authentication and token helpers to UnifiedSettingsMenu and ProfileSidebar.
- Provides WebSocket connection status and response handler to UnifiedSettingsMenu.

Customization and responsiveness:
- Uses fixed positioning for settings panel with smooth transitions.
- Applies backdrop filters and glass-morphism styling via CSS.

Accessibility and cross-browser compatibility:
- Relies on browser APIs (storage, identity, tabs) and applies minimal DOM manipulation.
- Global CSS ensures consistent styling across browsers.

**Section sources**
- [App.tsx](file://extension/entrypoints/sidepanel/App.tsx#L1-L200)
- [App.css](file://extension/entrypoints/sidepanel/App.css#L1-L349)

### UnifiedSettingsMenu: Configuration Management
Responsibilities:
- Hosts two tabs: Settings and Profile.
- Settings tab: model selection, API key management, base URL, Google/JIIT connections, WebSocket auto-connect toggle.
- Profile tab: displays user info, token age/expiry, and advanced details.

State management:
- Maintains active tab, selected LLM, auto-connect preference, and JIIT portal credentials.
- Persists preferences to browser storage and localStorage.

Integration:
- Receives authentication props from App.tsx and exposes callbacks for logout/manual refresh.
- Uses CuteTextInput for secure input and handles Enter key submission.

Styling and UX:
- Fixed-position panel with smooth slide-in/out transitions.
- Glass-morphism design with backdrop blur and gradient backgrounds.
- Interactive elements include hover/focus states and subtle animations.

**Section sources**
- [UnifiedSettingsMenu.tsx](file://extension/entrypoints/sidepanel/components/UnifiedSettingsMenu.tsx#L1-L1194)
- [CuteTextInput.tsx](file://extension/entrypoints/sidepanel/components/CuteTextInput.tsx#L1-L81)
- [ApiKeySection.tsx](file://extension/entrypoints/sidepanel/components/ApiKeySection.tsx#L1-L25)
- [SettingsSection.tsx](file://extension/entrypoints/sidepanel/components/SettingsSection.tsx#L1-L111)
- [WebSocketStatus.tsx](file://extension/entrypoints/sidepanel/components/WebSocketStatus.tsx#L1-L36)
- [select.tsx](file://extension/entrypoints/sidepanel/components/ui/select.tsx#L1-L186)

### ProfileSidebar: User Information Display
Responsibilities:
- Displays user avatar, name, email, and browser info.
- Shows token age/expiry and optional token visibility toggles.
- Provides manual refresh and logout actions.

Props and behavior:
- Controlled visibility via boolean prop; toggles via callback.
- Uses helper functions from App.tsx to compute token age/expiry.

Styling:
- Absolute positioning with shadow and gradient borders.
- Collapsible advanced details section using native details/summary.

**Section sources**
- [ProfileSidebar.tsx](file://extension/entrypoints/sidepanel/components/ProfileSidebar.tsx#L1-L326)

### ResponseSection: Agent Response Display
Responsibilities:
- Renders agent responses in a scrollable container with monospace-friendly styling.

Usage:
- Receives response string from App.tsx and conditionally renders when present.

**Section sources**
- [ResponseSection.tsx](file://extension/entrypoints/sidepanel/components/ResponseSection.tsx#L1-L15)
- [App.css](file://extension/entrypoints/sidepanel/App.css#L165-L176)

### LoadingScreen and SignInScreen: Authentication Flow
- LoadingScreen: Minimal header and loading message while auth resolves.
- SignInScreen: Animated onboarding with OAuth options and feature highlights.

Both screens integrate with useAuth hooks to trigger login flows and update state.

**Section sources**
- [LoadingScreen.tsx](file://extension/entrypoints/sidepanel/components/LoadingScreen.tsx#L1-L18)
- [SignInScreen.tsx](file://extension/entrypoints/sidepanel/components/SignInScreen.tsx#L1-L414)
- [useAuth.ts](file://extension/entrypoints/sidepanel/hooks/useAuth.ts#L1-L311)

### CuteTextInput: Reusable Input Component
Features:
- Focus state with animated underline.
- Enter key submission support.
- Password/text modes with placeholder and controlled value.

Integration:
- Used within UnifiedSettingsMenu for API key/base URL inputs.

**Section sources**
- [CuteTextInput.tsx](file://extension/entrypoints/sidepanel/components/CuteTextInput.tsx#L1-L81)

### SettingsSection and WebSocketStatus: Compact Controls
- SettingsSection: Collapsible settings with API key input and WebSocket connection toggle.
- WebSocketStatus: Simple indicator and reconnect button.

**Section sources**
- [SettingsSection.tsx](file://extension/entrypoints/sidepanel/components/SettingsSection.tsx#L1-L111)
- [WebSocketStatus.tsx](file://extension/entrypoints/sidepanel/components/WebSocketStatus.tsx#L1-L36)

### select.tsx: UI Primitive
- Provides a styled Select component set built on Radix UI with consistent theming and accessibility.

**Section sources**
- [select.tsx](file://extension/entrypoints/sidepanel/components/ui/select.tsx#L1-L186)

## Dependency Analysis
Component and hook dependencies:
- App.tsx depends on useAuth, useTabManagement, and useWebSocket.
- UnifiedSettingsMenu depends on browser storage/localStorage and the WebSocket client.
- ProfileSidebar consumes authentication props and helper functions.
- ResponseSection consumes response state from App.tsx.
- SignInScreen triggers authentication flows via useAuth.

```mermaid
graph LR
App["App.tsx"] --> Auth["useAuth.ts"]
App --> Tabs["useTabManagement.ts"]
App --> WS["useWebSocket.ts"]
App --> Settings["UnifiedSettingsMenu.tsx"]
App --> Profile["ProfileSidebar.tsx"]
App --> Response["ResponseSection.tsx"]
Settings --> Input["CuteTextInput.tsx"]
Settings --> API["ApiKeySection.tsx"]
Settings --> WSShort["SettingsSection.tsx"]
Settings --> WSStatus["WebSocketStatus.tsx"]
Settings --> Select["ui/select.tsx"]
Profile --> Input
Response --> CSS["App.css"]
```

**Diagram sources**
- [App.tsx](file://extension/entrypoints/sidepanel/App.tsx#L1-L200)
- [useAuth.ts](file://extension/entrypoints/sidepanel/hooks/useAuth.ts#L1-L311)
- [useTabManagement.ts](file://extension/entrypoints/sidepanel/hooks/useTabManagement.ts#L1-L94)
- [useWebSocket.ts](file://extension/entrypoints/sidepanel/hooks/useWebSocket.ts#L1-L49)
- [UnifiedSettingsMenu.tsx](file://extension/entrypoints/sidepanel/components/UnifiedSettingsMenu.tsx#L1-L1194)
- [ProfileSidebar.tsx](file://extension/entrypoints/sidepanel/components/ProfileSidebar.tsx#L1-L326)
- [ResponseSection.tsx](file://extension/entrypoints/sidepanel/components/ResponseSection.tsx#L1-L15)
- [CuteTextInput.tsx](file://extension/entrypoints/sidepanel/components/CuteTextInput.tsx#L1-L81)
- [ApiKeySection.tsx](file://extension/entrypoints/sidepanel/components/ApiKeySection.tsx#L1-L25)
- [SettingsSection.tsx](file://extension/entrypoints/sidepanel/components/SettingsSection.tsx#L1-L111)
- [WebSocketStatus.tsx](file://extension/entrypoints/sidepanel/components/WebSocketStatus.tsx#L1-L36)
- [select.tsx](file://extension/entrypoints/sidepanel/components/ui/select.tsx#L1-L186)
- [App.css](file://extension/entrypoints/sidepanel/App.css#L1-L349)

**Section sources**
- [App.tsx](file://extension/entrypoints/sidepanel/App.tsx#L1-L200)
- [UnifiedSettingsMenu.tsx](file://extension/entrypoints/sidepanel/components/UnifiedSettingsMenu.tsx#L1-L1194)
- [ProfileSidebar.tsx](file://extension/entrypoints/sidepanel/components/ProfileSidebar.tsx#L1-L326)
- [ResponseSection.tsx](file://extension/entrypoints/sidepanel/components/ResponseSection.tsx#L1-L15)
- [CuteTextInput.tsx](file://extension/entrypoints/sidepanel/components/CuteTextInput.tsx#L1-L81)
- [SettingsSection.tsx](file://extension/entrypoints/sidepanel/components/SettingsSection.tsx#L1-L111)
- [WebSocketStatus.tsx](file://extension/entrypoints/sidepanel/components/WebSocketStatus.tsx#L1-L36)
- [select.tsx](file://extension/entrypoints/sidepanel/components/ui/select.tsx#L1-L186)
- [useAuth.ts](file://extension/entrypoints/sidepanel/hooks/useAuth.ts#L1-L311)
- [useTabManagement.ts](file://extension/entrypoints/sidepanel/hooks/useTabManagement.ts#L1-L94)
- [useWebSocket.ts](file://extension/entrypoints/sidepanel/hooks/useWebSocket.ts#L1-L49)
- [App.css](file://extension/entrypoints/sidepanel/App.css#L1-L349)

## Performance Considerations
- Minimize re-renders by lifting state to App.tsx and passing only necessary props down.
- Debounce or throttle frequent updates (e.g., storage change listeners).
- Use lazy initialization for heavy resources (e.g., WebSocket client setup).
- Keep component trees shallow; avoid deep nesting of styled containers.
- Prefer CSS transitions for animations rather than JavaScript-driven ones.
- Utilize browser storage efficiently; batch writes and avoid excessive reads.

## Troubleshooting Guide
Common issues and resolutions:
- Authentication failures: Verify backend service availability and OAuth configuration. Check alerts emitted during login flows.
- WebSocket disconnections: Confirm auto-connect preference and network connectivity; use the reconnect button in settings.
- Tab updates not reflected: Ensure tab listeners are registered and cleaned up properly.
- Styling inconsistencies: Confirm global fonts are loaded and CSS selectors match component classes.

**Section sources**
- [useAuth.ts](file://extension/entrypoints/sidepanel/hooks/useAuth.ts#L128-L208)
- [useWebSocket.ts](file://extension/entrypoints/sidepanel/hooks/useWebSocket.ts#L19-L48)
- [useTabManagement.ts](file://extension/entrypoints/sidepanel/hooks/useTabManagement.ts#L14-L81)
- [App.css](file://extension/entrypoints/sidepanel/App.css#L344-L349)

## Conclusion
The Side Panel UI Components form a cohesive, modular system centered around App.tsx. They leverage React hooks for cross-cutting concerns, maintain consistent styling through global CSS, and provide intuitive controls for configuration and user profile management. The architecture supports scalability, accessibility, and cross-browser compatibility while keeping performance considerations front-of-mind.