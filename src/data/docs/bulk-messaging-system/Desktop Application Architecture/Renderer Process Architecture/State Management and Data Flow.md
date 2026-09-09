# State management and data flow

## Introduction
This page explains state management and data flow patterns in the renderer process of the BulkMessaging application. It focuses on how React state is organized within the BulkMailer component and coordinated across multiple messaging services (Gmail, SMTP, and WhatsApp). It documents the end-to-end flow from user interactions through component state to Electron IPC handlers, including state update patterns, event handling strategies, and UI consistency with backend service states. It also covers side effects handling, mutation patterns, and the integration between local component state and Electron's main process.

## Project structure
The renderer-side application is structured around a single-page React layout with a sidebar navigation and tabbed content areas. Each tab corresponds to a distinct messaging service with its own form and state management.

```mermaid
graph TB
subgraph "Renderer UI"
A["main.jsx<br/>Entry Point"]
B["App.jsx<br/>Root Component"]
C["BulkMailer.jsx<br/>Central State Container"]
D["Sidebar.jsx<br/>Navigation"]
E["TopBar.jsx<br/>Header"]
F["GmailForm.jsx<br/>Gmail Tab"]
G["SMTPForm.jsx<br/>SMTP Tab"]
H["WhatsAppForm.jsx<br/>WhatsApp Tab"]
I["Icons.jsx<br/>SVG Icons"]
end
subgraph "Electron Bridge"
J["preload.js<br/>Expose electronAPI"]
K["main.js<br/>IPC Handlers"]
L["gmail-handler.js<br/>Gmail Operations"]
M["smtp-handler.js<br/>SMTP Operations"]
end
subgraph "Utilities"
N["pyodide.js<br/>Python Parsing"]
end
A --> B
B --> C
C --> D
C --> E
C --> F
C --> G
C --> H
F --> I
G --> I
H --> I
C --> J
J --> K
K --> L
K --> M
H --> N
```

## Core components
- BulkMailer: Central orchestrator managing cross-service state, coordinating IPC calls, and handling side effects. It initializes listeners for real-time updates and exposes actions for each service.
- Form components: GmailForm, SMTPForm, and WhatsAppForm encapsulate UI state and present service-specific controls. They receive props from BulkMailer and trigger actions via callbacks.
- Preload bridge: Exposes a controlled API surface to the renderer, mapping Electron IPC channels to JavaScript functions.
- Main process handlers: Implement service-specific logic for Gmail, SMTP, and WhatsApp, emitting events back to the renderer.

Key state containers in BulkMailer:
- Tabs and navigation: activeTab
- Gmail: isGmailAuthenticated, emailList, subject, message, delay, results, isSending
- SMTP: smtpConfig, emailList, subject, message, delay, results, isSending
- WhatsApp: waContacts, waMessage, waStatus, waQR, waSending, waResults, isSending

## Architecture overview
The renderer process follows a unidirectional data flow:
- User interactions update component state via React hooks.
- Actions dispatch Electron IPC invocations through the preload bridge.
- Main process handlers execute backend operations and emit events back to the renderer.
- Renderer updates state in response to events, maintaining UI consistency.

```mermaid
sequenceDiagram
participant U as "User"
participant BM as "BulkMailer.jsx"
participant GF as "GmailForm.jsx"
participant PF as "preload.js"
participant MP as "main.js"
participant GH as "gmail-handler.js"
participant SM as "smtp-handler.js"
U->>GF : Click "Send Bulk Email"
GF->>BM : sendGmailBulk()
BM->>PF : ipcRenderer.invoke("send-email", payload)
PF->>MP : route to handleSendEmail
MP->>GH : handleSendEmail(payload)
GH-->>MP : {results}
MP-->>PF : event.sender.send("email-progress", ...)
PF-->>BM : onProgress(callback) emits updates
BM->>BM : setResults([...prev, update])
BM-->>GF : results prop updated
```

## Detailed component analysis

### BulkMailer: central state orchestrator
Responsibilities:
- Maintains cross-service state (tabs, Gmail, SMTP, WhatsApp).
- Subscribes to real-time events from the main process for live updates.
- Provides action functions that wrap IPC invocations and manage loading states.
- Validates forms and prepares payloads for backend handlers.

State management patterns:
- Local state for UI and service-specific data.
- Controlled updates via setState callbacks passed to child components.
- Side effect orchestration using useEffect for event subscriptions and cleanup.

Event handling:
- Registers listeners for WhatsApp status, QR, and send status updates.
- Unregisters listeners on component unmount to prevent leaks.

IPC coordination:
- Uses window.electronAPI.invoke for request-response IPC.
- Uses window.electronAPI.on for event-driven updates.

UI consistency:
- Updates results arrays incrementally as events arrive.
- Sets isSending flags to disable controls during operations.

Examples of state mutations:
- Updating emailList and subject for Gmail/SMTP tabs.
- Setting waQR and waStatus upon receiving QR or status events.
- Mutating results arrays with new progress entries.

Side effects:
- Authentication checks on mount.
- Cleanup of event listeners on unmount.
- File import and parsing via Pyodide.

### GmailForm: gmail service UI and state
Responsibilities:
- Manages Gmail-specific state: authentication flag, recipients list, subject, message, delay, results, and sending state.
- Provides actions to authenticate, import email lists, and send emails.

State update patterns:
- Controlled inputs update local state via setters.
- Results array is updated from BulkMailer-provided results prop.

Event handling:
- Disables buttons when sending is in progress.
- Uses authentication status to conditionally render UI.

Integration with BulkMailer:
- Receives props for all state and callbacks.
- Triggers sendGmailBulk action on submit.

### SMTPForm: SMTP service UI and state
Responsibilities:
- Manages SMTP configuration and email composition state.
- Provides actions to import email lists and send emails via SMTP.

State update patterns:
- Structured state for SMTP config (host, port, secure, user, pass).
- Controlled inputs update the config object immutably.

Event handling:
- Enables/disables send button based on configuration completeness and input validity.

Integration with BulkMailer:
- Receives props for all state and callbacks.
- Triggers sendSMTPBulk action on submit.

### WhatsAppForm: WhatsApp service UI and state
Responsibilities:
- Manages WhatsApp-specific state: contacts, message, status, QR, sending state, and results.
- Provides actions to connect, import contacts, and send messages.

State update patterns:
- Local logEntries state for UI logs independent of backend results.
- Controlled updates for contacts and message text.
- Status colorization based on status text.

Event handling:
- Displays QR code when provided by main process.
- Adds log entries for UI feedback.

Integration with BulkMailer:
- Receives props for all state and callbacks.
- Triggers startWhatsAppClient, logoutWhatsApp, importWhatsAppContacts, and sendWhatsAppBulk actions.

### Preload bridge: electron API exposure
Responsibilities:
- Exposes a safe, typed API to the renderer via contextBridge.
- Maps IPC channels to invoke/on methods for Gmail, SMTP, file operations, and WhatsApp.

Patterns:
- invoke("channel", payload) for request-response.
- on("channel", callback) for event streams.
- Returns removal functions to unsubscribe from events.

### Main process handlers: backend execution and events
Responsibilities:
- Gmail: Handles OAuth flow, token storage, and batch email sending with progress events.
- SMTP: Validates configuration, creates transport, verifies connectivity, and sends emails with progress events.
- WhatsApp: Initializes client, emits QR and status events, handles message sending loop, and logout.

Patterns:
- ipcMain.handle registers request handlers.
- event.sender.send emits progress and status events back to renderer.
- Cleanup and error handling in handlers.

### Data flow: from user interaction to backend and back
End-to-end flow for Gmail bulk send:

```mermaid
sequenceDiagram
participant U as "User"
participant GF as "GmailForm.jsx"
participant BM as "BulkMailer.jsx"
participant PF as "preload.js"
participant MP as "main.js"
participant GH as "gmail-handler.js"
U->>GF : Type subject/message, select recipients
U->>GF : Click "Send Bulk Email"
GF->>BM : sendGmailBulk()
BM->>BM : setIsSending(true), results=[]
BM->>PF : ipcRenderer.invoke("send-email", payload)
PF->>MP : handleSendEmail(payload)
MP->>GH : send emails with delays
GH-->>MP : results[]
MP-->>PF : event.sender.send("email-progress", update)
PF-->>BM : onProgress(callback) invoked
BM->>BM : setResults(prev => [...prev, update])
BM->>BM : setIsSending(false)
BM-->>GF : results prop updated
```

### State update patterns and event handling strategies
- Controlled inputs: Each form component manages its own state via useState and passes setters to BulkMailer.
- Event-driven updates: BulkMailer subscribes to onProgress and WhatsApp events; updates results arrays and status fields.
- Conditional rendering: UI reflects state (e.g., authentication status, sending state, QR display).
- Validation: Forms validate inputs before invoking IPC; BulkMailer performs additional checks for service readiness.
- Error handling: Try/catch blocks wrap IPC calls; alerts provide user feedback; errors are logged.

Mutation examples:
- Immutable updates: setSMTPConfig({...}) and [...prev, newItem].
- Controlled toggles: setDelay(value) and checkbox updates.
- Batch updates: setIsSending(true/false) around long-running operations.

### Integration between local component state and global application state
- Local component state: Managed by individual form components for immediate UI feedback.
- Cross-service state: BulkMailer centralizes shared state and actions, enabling coordinated behavior across services.
- Electron state: Token and configuration persistence handled in main process handlers; renderer reads state via IPC queries.
- UI consistency: Real-time events keep the UI synchronized with backend progress and status.

## Dependency analysis
The renderer depends on the preload bridge for IPC, which routes to main process handlers. Handlers depend on external libraries and filesystem operations.

```mermaid
graph LR
BM["BulkMailer.jsx"] --> PF["preload.js"]
PF --> MP["main.js"]
MP --> GH["gmail-handler.js"]
MP --> SH["smtp-handler.js"]
BM --> WF["WhatsAppForm.jsx"]
WF --> PY["pyodide.js"]
BM --> GF["GmailForm.jsx"]
BM --> SF["SMTPForm.jsx"]
BM --> SB["Sidebar.jsx"]
BM --> TB["TopBar.jsx"]
```

## Performance considerations
- Debounce or throttle heavy operations: Consider debouncing input updates for large recipient lists.
- Virtualized lists: For large results/logs, consider virtualization to reduce DOM nodes.
- Efficient state updates: Use immutable updates to minimize re-renders; batch related state changes.
- IPC batching: Group small updates into fewer IPC events to reduce overhead.
- Lazy initialization: Defer expensive operations until needed (e.g., Pyodide loading).
- Cleanup: Ensure event listeners are removed on unmount to prevent memory leaks.

## Troubleshooting guide
Common issues and resolutions:
- Electron API not available: Ensure preload bridge is loaded and window.electronAPI is exposed. Check main process webPreferences and preload path.
- Authentication failures: Verify environment variables for Gmail OAuth and network connectivity. Check timeout handling and error messages.
- Progress events not updating: Confirm onProgress registration and removal; ensure event channel names match.
- WhatsApp QR not displaying: Validate QR event emission and image handling; check for CORS or base64 decoding issues.
- SMTP verification failures: Verify host/port/credentials; enable TLS settings appropriately.

## Conclusion
The BulkMailer component is the central coordinator for state and IPC in the renderer process. It integrates three distinct messaging services, Gmail, SMTP, and WhatsApp, by maintaining local state, subscribing to real-time events, and orchestrating IPC calls. The design emphasizes controlled updates, event-driven synchronization, and reliable error handling, ensuring a responsive and consistent user experience across services.
