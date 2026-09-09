# Security model and isolation

## Introduction
This page explains the Electron security model implementation in the project, focusing on context isolation, preload scripts, and IPC security patterns. It documents the BrowserWindow webPreferences configuration, the responsibilities of the preload script, and how the main process restricts sensitive operations. It also covers input validation strategies and best practices for desktop application security aligned with Electron security guidelines.

## Project structure
The Electron application is organized into:
- Main process code under electron/src/electron/, including BrowserWindow creation, IPC handlers, and platform integrations
- Renderer UI built with React and served via Vite, located under electron/src/ui/ and electron/src/components/
- Build and packaging configuration under electron/

```mermaid
graph TB
subgraph "Main Process"
M["main.js"]
P["preload.js"]
GH["gmail-handler.js"]
SH["smtp-handler.js"]
U["utils.js"]
end
subgraph "Renderer Process"
BM["BulkMailer.jsx"]
WF["WhatsAppForm.jsx"]
GF["GmailForm.jsx"]
SF["SMTPForm.jsx"]
end
subgraph "Build & Packaging"
PKG["package.json"]
VC["vite.config.js"]
IH["index.html"]
end
M --> P
M --> GH
M --> SH
BM --> WF
BM --> GF
BM --> SF
P --> BM
PKG --> VC
VC --> IH
```

## Core components
- BrowserWindow with security-focused webPreferences
- Preload script exposing a minimal Electron API surface to the renderer
- IPC handlers in the main process managing sensitive operations
- Renderer components validating inputs and delegating to the preload API

Key security configurations:
- nodeIntegration: false
- contextIsolation: true
- enableRemoteModule: false
- webSecurity: true
- preload script path configured

These settings enforce a strict boundary between the renderer and main process, preventing direct access to Node.js APIs from the renderer and isolating the context.

## Architecture overview
The application follows a secure IPC pattern:
- Renderer invokes window.electronAPI methods exposed by the preload script
- Preload script forwards requests to ipcRenderer.invoke
- Main process handles IPC via ipcMain.handle and performs sensitive operations
- Results are sent back via ipcRenderer.on listeners or response values

```mermaid
sequenceDiagram
participant R as "Renderer (React)"
participant PB as "Preload Bridge"
participant MR as "Main Process"
participant GH as "Gmail Handler"
participant SH as "SMTP Handler"
R->>PB : "invoke('gmail-auth')"
PB->>MR : "ipcRenderer.invoke('gmail-auth')"
MR->>GH : "handleGmailAuth()"
GH-->>MR : "auth result"
MR-->>PB : "auth result"
PB-->>R : "auth result"
```

## Detailed component analysis

### BrowserWindow security configuration
The BrowserWindow is created with strict security defaults:
- nodeIntegration: false prevents Node.js APIs from being directly accessible in the renderer
- contextIsolation: true ensures the renderer runs in an isolated world separate from the main context
- enableRemoteModule: false disables the remote module that could bypass context isolation
- webSecurity: true enforces same-origin policy and related security checks
- preload: path specifies the preload script that bridges the secure IPC channel

These settings form the foundation for a secure renderer.

### Preload script responsibilities
The preload script exposes a controlled API surface to the renderer:
- Uses contextBridge.exposeInMainWorld to publish window.electronAPI
- Exposes only whitelisted methods for Gmail, SMTP, file operations, and WhatsApp
- Provides event listeners for progress and status updates
- Delegates all sensitive operations to ipcRenderer.invoke

Responsibilities:
- Validate argument shapes before invoking IPC
- Return sanitized responses to the renderer
- Avoid exposing internal Electron APIs or Node.js modules
- Maintain a minimal interface to reduce attack surface

```mermaid
classDiagram
class PreloadBridge {
+exposeInMainWorld("electronAPI")
+authenticateGmail()
+sendEmail(emailData)
+sendSMTPEmail(smtpData)
+importEmailList()
+readEmailListFile(filePath)
+onProgress(callback)
+startWhatsAppClient()
+logoutWhatsApp()
+sendWhatsAppMessages(data)
+importWhatsAppContacts()
+onWhatsAppStatus(callback)
+onWhatsAppQR(callback)
+onWhatsAppSendStatus(callback)
}
```

### IPC handlers and sensitive operations
The main process registers ipcMain.handle handlers for all sensitive operations:
- Gmail: authentication, token retrieval, and email sending
- SMTP: email sending with configurable transport
- WhatsApp: client lifecycle, QR display, message sending, and logout
- File dialogs and parsing for email lists

Security patterns:
- Validate inputs and configuration before performing operations
- Use dedicated handler functions for each operation
- Emit progress/status events via event channels
- Clean up resources and sessions on logout or app exit

```mermaid
flowchart TD
Start(["IPC Request"]) --> Validate["Validate Inputs"]
Validate --> Valid{"Valid?"}
Valid --> |No| ReturnError["Return Error"]
Valid --> |Yes| Perform["Perform Operation"]
Perform --> Emit["Emit Events / Return Result"]
Emit --> End(["Response"])
ReturnError --> End
```

### Renderer integration and event handling
The renderer integrates with the preload bridge:
- BulkMailer.jsx listens to WhatsApp status and QR events
- Uses window.electronAPI methods to trigger operations
- Validates forms and sanitizes inputs before invoking IPC
- Displays progress and results from emitted events

Security practices in the renderer:
- Input validation for email formats and numeric delays
- Controlled enabling/disabling of UI actions during long-running operations
- Graceful error handling and user feedback

```mermaid
sequenceDiagram
participant UI as "BulkMailer.jsx"
participant BR as "Preload Bridge"
participant MW as "Main Window"
participant WH as "WhatsApp Client"
UI->>BR : "startWhatsAppClient()"
BR->>MW : "ipcRenderer.invoke('whatsapp-start-client')"
MW->>WH : "initialize client"
WH-->>MW : "emit 'whatsapp-status'"
MW-->>BR : "status message"
BR-->>UI : "status message"
UI->>BR : "sendWhatsAppMessages({contacts,message})"
BR->>MW : "ipcRenderer.invoke('whatsapp-send-messages', data)"
MW-->>BR : "progress and results"
BR-->>UI : "results"
```

### Input validation strategies
The renderer implements client-side validation:
- Email list import validates presence of subject and message
- Email format validation using a regular expression
- Numeric delay validation and bounds
- Contact list validation for WhatsApp bulk messaging

Best practices:
- Validate early and fail fast
- Sanitize inputs before IPC
- Provide clear user feedback on validation failures
- Avoid relying solely on client-side validation for security-sensitive operations

### Security best practices and compliance
- Context Isolation: Enforced via webPreferences and contextBridge
- Minimal API Exposure: Only necessary methods exposed via preload
- IPC Validation: Main process validates all inputs and configuration
- Resource Cleanup: Sessions and temporary files cleaned on logout and app exit
- Environment Separation: Development vs production loading paths
- Secure Transport: SMTP TLS configuration and Gmail OAuth2 flow

[No sources needed since this section provides general guidance]

## Dependency analysis
The main process depends on:
- Electron's BrowserWindow, ipcMain, dialog, and filesystem APIs
- External libraries for email (googleapis, nodemailer), QR generation, and WhatsApp integration
- Preload script for secure IPC bridging

```mermaid
graph LR
M["main.js"] --> P["preload.js"]
M --> GH["gmail-handler.js"]
M --> SH["smtp-handler.js"]
M --> U["utils.js"]
BM["BulkMailer.jsx"] --> P
BM --> WF["WhatsAppForm.jsx"]
BM --> GF["GmailForm.jsx"]
BM --> SF["SMTPForm.jsx"]
```

## Performance considerations
- Rate limiting delays between operations to respect service quotas
- Debounce or throttle UI interactions during long-running tasks
- Efficient event handling to avoid memory leaks (removing listeners)
- Minimize IPC chatter by batching operations when possible

[No sources needed since this section provides general guidance]

## Troubleshooting guide
Common issues and resolutions:
- Electron API not available: Ensure preload is correctly configured and window.electronAPI is present
- Authentication timeouts: Check OAuth redirect URI and environment variables
- File import errors: Verify file filters and path resolution
- WhatsApp client initialization failures: Confirm network connectivity and puppeteer arguments

## Conclusion
The application implements a reliable Electron security model by enforcing context isolation, exposing a minimal preload API, and centralizing sensitive operations in the main process. Input validation occurs at both the renderer and main process boundaries, and IPC handlers provide structured, validated access to external services. These patterns align with Electron security guidelines and help protect against common vulnerabilities in desktop applications.
