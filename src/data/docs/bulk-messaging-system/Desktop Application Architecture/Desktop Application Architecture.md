# Desktop application architecture

## Introduction
This page describes the desktop application architecture built with Electron, React, and integrated Python utilities. It explains the separation between the main process and renderer process, secure IPC patterns, React component architecture, state management, security model, build system, and performance considerations.

## Project structure
The project is organized into:
- Electron main process and preload scripts under electron/src/electron
- React UI under electron/src/ui and components under electron/src/components
- Shared utilities under electron/src/utils
- Bundled frontend assets under electron/dist-react
- Build configuration for Vite and electron-builder under electron/

```mermaid
graph TB
subgraph "Electron Main Process"
M["main.js"]
GM["gmail-handler.js"]
SM["smtp-handler.js"]
U["utils.js"]
end
subgraph "Preload Bridge"
P["preload.js"]
end
subgraph "Renderer Process (React)"
RUI["main.jsx"]
APP["App.jsx"]
BM["BulkMailer.jsx"]
WAF["WhatsAppForm.jsx"]
GIF["GmailForm.jsx"]
SIF["SMTPForm.jsx"]
PY["pyodide.js"]
end
subgraph "Bundled Assets"
D["dist-react/"]
end
M --> P
P --> RUI
RUI --> APP
APP --> BM
BM --> WAF
BM --> GIF
BM --> SIF
BM --> PY
M --> GM
M --> SM
M --> D
```

## Core components
- Main process: Creates the BrowserWindow, configures webPreferences, registers IPC handlers, manages lifecycle events, and orchestrates external integrations (Gmail, SMTP, WhatsApp).
- Preload bridge: Exposes a controlled API surface to the renderer via contextBridge, enabling secure IPC invocations and event listeners.
- Renderer (React): Stateless functional components manage UI state locally, delegate long-running tasks to the main process via IPC, and render real-time updates.
- Handlers: Encapsulate business logic for Gmail OAuth, token storage, email sending, and SMTP transport verification and sending.
- Utilities: Pyodide integration for parsing manual numbers using Python scripts bundled in dist-react.

## Architecture overview
The system follows a strict main/renderer separation:
- Main process runs privileged operations (filesystem, network APIs, external service integrations).
- Renderer process renders UI and delegates heavy work to main via typed IPC channels.
- Preload script defines the Electron API surface exposed to renderer code.

```mermaid
graph TB
subgraph "Renderer (React)"
UI["React Components<br/>BulkMailer, Forms"]
API["window.electronAPI<br/>(preload bridge)"]
end
subgraph "IPC Bridge"
INV["ipcRenderer.invoke"]
EVT["ipcRenderer.on / removeListener"]
end
subgraph "Main Process"
H1["Gmail Handler"]
H2["SMTP Handler"]
H3["WhatsApp IPC"]
FS["File System & Dialogs"]
end
UI --> API
API --> INV
INV --> H1
INV --> H2
INV --> H3
H1 --> FS
H2 --> FS
H3 --> FS
H1 --> EVT
H2 --> EVT
H3 --> EVT
EVT --> UI
```

## Detailed component analysis

### Main process responsibilities
- Window creation with context isolation and secure defaults.
- Registration of IPC handlers for Gmail, SMTP, and WhatsApp operations.
- Lifecycle management: startup cleanup, window-all-closed, before-quit.
- Real-time status updates via event emitters to renderer.

```mermaid
sequenceDiagram
participant R as "Renderer"
participant P as "Preload Bridge"
participant M as "Main Process"
R->>P : invoke("whatsapp-start-client")
P->>M : ipcMain.handle("whatsapp-start-client")
M-->>R : webContents.send("whatsapp-status", "Initializing...")
M-->>R : webContents.send("whatsapp-qr", dataURL)
M-->>R : webContents.send("whatsapp-status", "Client ready!")
M-->>R : webContents.send("whatsapp-qr", null)
```

### Preload bridge and secure IPC
- Exposes a single electronAPI object with typed methods for Gmail, SMTP, file dialogs, and WhatsApp operations.
- Uses ipcRenderer.invoke for request/response semantics and ipcRenderer.on for event streams.
- Returns removal functions to detach listeners in components.

```mermaid
classDiagram
class PreloadBridge {
+authenticateGmail() invoke
+getGmailToken() invoke
+sendEmail(data) invoke
+sendSMTPEmail(data) invoke
+importEmailList() invoke
+readEmailListFile(path) invoke
+onProgress(cb) on/remove
+startWhatsAppClient() invoke
+logoutWhatsApp() invoke
+sendWhatsAppMessages(data) invoke
+importWhatsAppContacts() invoke
+onWhatsAppStatus(cb) on/remove
+onWhatsAppQR(cb) on/remove
+onWhatsAppSendStatus(cb) on/remove
}
```

### Gmail handler
- Implements OAuth2 flow with a dedicated BrowserWindow for consent.
- Stores tokens securely using electron-store.
- Sends emails via Gmail API with progress events.

```mermaid
sequenceDiagram
participant R as "Renderer"
participant P as "Preload Bridge"
participant M as "Main Process"
participant GH as "Gmail Handler"
participant G as "Gmail API"
R->>P : invoke("gmail-auth")
P->>M : ipcMain.handle("gmail-auth")
M->>GH : handleGmailAuth()
GH->>GH : open BrowserWindow with auth URL
GH-->>M : resolve({success}) or {error}
M-->>R : result
R->>P : invoke("send-email", payload)
P->>M : ipcMain.handle("send-email")
M->>GH : handleSendEmail(event, payload)
GH->>G : users.messages.send(...)
GH-->>M : {success, results}
M-->>R : {success, results}
```

### SMTP handler
- Validates configuration, verifies transport, and sends emails with progress events.
- Optionally persists partial SMTP config using electron-store.

```mermaid
flowchart TD
Start(["invoke('smtp-send', data)"]) --> Validate["Validate config fields"]
Validate --> Valid{"Valid?"}
Valid --> |No| ReturnErr["Return {success:false, error}"]
Valid --> |Yes| Create["Create Nodemailer Transport"]
Create --> Verify["transporter.verify()"]
Verify --> SendLoop["For each recipient"]
SendLoop --> Progress["event.sender.send('email-progress', {...})"]
Progress --> Next{"More recipients?"}
Next --> |Yes| Delay["setTimeout(delay)"] --> SendLoop
Next --> |No| Done["Return {success:true, results}"]
```

### WhatsApp integration
- Initializes a WhatsApp client with local authentication and headless puppeteer.
- Emits QR code as a data URL and status updates to the renderer.
- Supports importing contacts from CSV/Text and sending mass messages with rate limiting.

```mermaid
sequenceDiagram
participant R as "Renderer"
participant P as "Preload Bridge"
participant M as "Main Process"
participant WA as "WhatsApp Client"
R->>P : invoke("whatsapp-start-client")
P->>M : ipcMain.handle("whatsapp-start-client")
M->>WA : new Client(LocalAuth)
WA-->>M : emit("qr", token)
M-->>R : webContents.send("whatsapp-qr", dataURL)
WA-->>M : emit("ready"|"authenticated")
M-->>R : webContents.send("whatsapp-status", "...")
R->>P : invoke("whatsapp-send-messages", {contacts, message})
P->>M : ipcMain.handle("whatsapp-send-messages")
loop per contact
M->>WA : isRegisteredUser(chatId)
M->>WA : sendMessage(chatId, personalizedMessage)
M-->>R : webContents.send("whatsapp-send-status", msg)
end
M-->>R : {success, sent, failed}
```

### React + electron integration
- App initializes React DOM and renders BulkMailer.
- BulkMailer coordinates state for Gmail, SMTP, and WhatsApp tabs.
- Components subscribe to preload-provided event streams and call invoke methods for actions.

```mermaid
graph LR
RM["React Main (main.jsx)"] --> APP["App.jsx"]
APP --> BM["BulkMailer.jsx"]
BM --> WAF["WhatsAppForm.jsx"]
BM --> GIF["GmailForm.jsx"]
BM --> SIF["SMTPForm.jsx"]
BM --> PY["pyodide.js"]
BM --> PRE["preload.js (electronAPI)"]
```

### Python backend utilities via pyodide
- Loads Pyodide runtime and Python script dynamically.
- Parses manual numbers using a Python utility and returns structured contacts.

```mermaid
flowchart TD
A["parseManualNumbers(text)"] --> B["loadPyodideAndScript()"]
B --> C{"pyLoaded?"}
C --> |No| D["Fetch parse_manual_numbers.py"]
D --> E["runPythonAsync(script)"]
E --> F["Set pyLoaded=true"]
C --> |Yes| G["Escape and runPythonAsync(...)"]
G --> H["JSON.parse(resultJson)"]
H --> I["Return {success, contacts, count}"]
```

## Dependency analysis
- Electron main depends on handlers and filesystem/dialogs.
- Preload depends on Electron's contextBridge and ipcRenderer.
- Renderer depends on React and the preload bridge.
- Build system produces dist-react assets consumed by main process.

```mermaid
graph TB
PJSON["package.json"]
VCFG["vite.config.js"]
EBCFG["electron-builder.json"]
PJSON --> VCFG
PJSON --> EBCFG
PJSON --> MAIN["main.js"]
MAIN --> GH["gmail-handler.js"]
MAIN --> SH["smtp-handler.js"]
MAIN --> PRE["preload.js"]
MAIN --> DIST["dist-react/"]
```

## Performance considerations
- Headless browser for WhatsApp with sandbox and GPU disabled to reduce overhead.
- Rate limiting delays between messages to avoid throttling.
- Event-driven progress updates to keep UI responsive.
- Cleanup of cache and auth directories on logout/close to prevent resource leaks.
- Tailwind-based rendering avoids heavy CSS frameworks; optimize images and minimize DOM thrashing.

[No sources needed since this section provides general guidance]

## Security model
- Context Isolation enabled in BrowserWindow webPreferences.
- Node.js integration disabled; remote module disabled.
- Preload script exposes only explicitly whitelisted methods via contextBridge.
- IPC uses typed channels with invoke for requests and on/removeListener for events.
- Environment variables for OAuth secrets; token storage via electron-store.
- Strict webSecurity enabled.

## Build system
- Vite builds the React frontend into dist-react with base "./" and outDir "dist-react".
- Electron main entry configured in package.json; scripts orchestrate dev and prod flows.
- electron-builder targets macOS DMG, Linux AppImage, and Windows portable/msi with appId and extra resources.

## Component interaction diagrams

### Gmail workflow
```mermaid
sequenceDiagram
participant UI as "GmailForm.jsx"
participant BM as "BulkMailer.jsx"
participant P as "preload.js"
participant M as "main.js"
participant GH as "gmail-handler.js"
UI->>BM : onClick("Authenticate Gmail")
BM->>P : invoke("gmail-auth")
P->>M : ipcMain.handle("gmail-auth")
M->>GH : handleGmailAuth()
GH-->>M : {success|error}
M-->>P : result
P-->>BM : result
BM-->>UI : set isGmailAuthenticated
UI->>BM : onClick("Send Bulk Email")
BM->>P : invoke("send-email", payload)
P->>M : ipcMain.handle("send-email")
M->>GH : handleSendEmail(event, payload)
GH-->>M : {success, results}
M-->>P : result
P-->>BM : result
BM-->>UI : update results
```

### WhatsApp workflow
```mermaid
sequenceDiagram
participant UI as "WhatsAppForm.jsx"
participant BM as "BulkMailer.jsx"
participant P as "preload.js"
participant M as "main.js"
UI->>BM : onClick("Connect to WhatsApp")
BM->>P : invoke("whatsapp-start-client")
P->>M : ipcMain.handle("whatsapp-start-client")
M-->>P : webContents.send("whatsapp-qr", dataURL)
P-->>BM : onWhatsAppQR callback
M-->>P : webContents.send("whatsapp-status", "Client ready!")
P-->>BM : onWhatsAppStatus callback
UI->>BM : onClick("Send Mass Messages")
BM->>P : invoke("whatsapp-send-messages", {contacts, message})
P->>M : ipcMain.handle("whatsapp-send-messages")
loop per contact
M-->>P : webContents.send("whatsapp-send-status", msg)
P-->>BM : onWhatsAppSendStatus callback
end
M-->>P : {success, sent, failed}
P-->>BM : result
```

### SMTP workflow
```mermaid
sequenceDiagram
participant UI as "SMTPForm.jsx"
participant BM as "BulkMailer.jsx"
participant P as "preload.js"
participant M as "main.js"
participant SH as "smtp-handler.js"
UI->>BM : onClick("Send SMTP Email")
BM->>P : invoke("smtp-send", payload)
P->>M : ipcMain.handle("smtp-send")
M->>SH : handleSMTPSend(event, payload)
SH-->>M : {success, results}
M-->>P : result
P-->>BM : result
BM-->>UI : update results
```

## Troubleshooting guide
- WhatsApp QR not loading: Check status events and retry connection; inspect console for QR generation errors.
- Gmail authentication timeout: Ensure environment variables are set and redirect URI matches; window closes after timeout.
- SMTP verification failure: Confirm host/port/credentials; TLS settings; verify with transporter.verify().
- File import issues: Validate CSV/Text formats; ensure proper column names for CSV parsing.
- Dev vs Production: Development loads from Vite server; production loads from dist-react; confirm paths and existence.

## Conclusion
This architecture cleanly separates concerns between main and renderer processes, enforces a secure IPC boundary via preload, and integrates React for UI with reliable handlers for Gmail, SMTP, and WhatsApp. The build system uses Vite and electron-builder for efficient development and cross-platform distribution. Following the outlined security and performance recommendations ensures a reliable, maintainable desktop application.
