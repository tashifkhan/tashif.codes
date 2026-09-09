# File system operations

## Introduction
This page explains file system operations within the Electron main process, focusing on:
- Contact import for CSV and TXT files for WhatsApp messaging
- Email list import supporting multiple formats with validation
- File reading mechanisms using Node.js streams and synchronous operations
- Dialog-based file selection with filter configurations
- Error handling strategies for file access failures, invalid formats, and permission issues
- Security considerations for file system access and path validation

## Project structure
The Electron application is organized into:
- Electron main process and preload bridge
- Frontend React components for UI and user interaction
- Python backend utilities for advanced parsing and validation
- Handlers for Gmail and SMTP operations

```mermaid
graph TB
subgraph "Electron Main Process"
M["main.js"]
P["preload.js"]
GH["gmail-handler.js"]
SH["smtp-handler.js"]
end
subgraph "Frontend"
BM["BulkMailer.jsx"]
WF["WhatsAppForm.jsx"]
PY["pyodide.js"]
end
subgraph "Python Backend"
EC["extract_contacts.py"]
PMN["parse_manual_numbers.py"]
VN["validate_number.py"]
end
BM --> P
WF --> P
P --> M
M --> GH
M --> SH
WF --> PY
PY --> PMN
M --> EC
M --> VN
```

## Core components
- Electron main process IPC handlers for file operations:
  - WhatsApp contact import from CSV/TXT using streams and synchronous reads
  - Email list import dialog and content parsing for CSV/TXT
- Preload bridge exposing secure APIs to the renderer
- Frontend components orchestrating user interactions and invoking IPC
- Python utilities for reliable parsing and validation

Key responsibilities:
- Dialog-based file selection with filters
- Streaming CSV parsing and synchronous TXT parsing
- Validation and sanitization of parsed data
- Error propagation and user feedback

## Architecture overview
End-to-end flow for importing and parsing contacts and email lists:

```mermaid
sequenceDiagram
participant UI as "WhatsAppForm.jsx"
participant Pre as "preload.js"
participant Main as "main.js"
participant FS as "Node.js fs"
participant CSV as "csv-parser"
UI->>Pre : invoke("whatsapp-import-contacts")
Pre->>Main : ipc invoke("whatsapp-import-contacts")
Main->>Main : dialog.showOpenDialog(filters)
Main->>FS : createReadStream(filePath) or readFileSync(filePath)
alt CSV
Main->>CSV : pipe stream
CSV-->>Main : "data" rows
Main-->>Pre : contacts[]
else TXT
Main-->>Pre : contacts[] from split/trim
end
Pre-->>UI : contacts[]
```

## Detailed component analysis

### WhatsApp contact import (CSV/TXT)
- Dialog configuration allows selecting single file with filters for TXT and CSV
- File extension determines parsing strategy:
  - CSV: stream-based parsing using Node.js streams and csv-parser
  - TXT: synchronous read with line-by-line processing and comma-separated values
- Parsing logic:
  - CSV: collects rows with number field; trims values; supports optional name field
  - TXT: splits by newline, trims each line, splits by comma into number/name
- Error handling:
  - Stream errors are caught and handled gracefully by returning empty array
  - Unsupported file type returns null
  - Synchronous read errors are caught and return empty array

```mermaid
flowchart TD
Start(["Invoke import"]) --> Dialog["Open File Dialog<br/>Filters: txt, csv"]
Dialog --> HasFile{"Selected file?"}
HasFile --> |No| ReturnNull["Return null"]
HasFile --> |Yes| ExtCheck["Determine extension"]
ExtCheck --> IsCSV{"Extension is .csv?"}
IsCSV --> |Yes| StreamRead["Stream read via fs.createReadStream"]
StreamRead --> PipeCSV["Pipe to csv-parser"]
PipeCSV --> OnData["On 'data': push {number,name}"]
PipeCSV --> OnEnd["On 'end': resolve contacts"]
PipeCSV --> OnErr["On 'error': reject/error handling"]
IsCSV --> |No| IsTXT{"Extension is .txt?"}
IsTXT --> |Yes| SyncRead["fs.readFileSync(filePath,'utf-8')"]
SyncRead --> SplitLines["Split by newline"]
SplitLines --> ParseLine["Trim and split by ','"]
ParseLine --> PushContact["Push {number,name}"]
PushContact --> Done(["Return contacts"])
IsTXT --> |No| Unsupported["Throw/return unsupported"]
Unsupported --> Done
```

### Email list import and parsing (CSV/TXT)
- Dialog configuration allows selecting a single file with filters for TXT and CSV
- After selection, the app reads the file content:
  - CSV: stream-based parsing; attempts to detect email columns by common names or falls back to first column; filters entries containing "@"; joins lines with newline
  - TXT: splits by newline, trims, filters non-empty lines containing "@"
- Error handling:
  - Catches exceptions during file read and rethrows for upstream handling
  - Logs errors to console for diagnostics

```mermaid
sequenceDiagram
participant UI as "BulkMailer.jsx"
participant Pre as "preload.js"
participant Main as "main.js"
participant FS as "Node.js fs"
participant CSV as "csv-parser"
UI->>Pre : invoke("import-email-list")
Pre->>Main : ipc invoke("import-email-list")
Main-->>Pre : { canceled, filePaths }
Pre-->>UI : { canceled, filePaths }
UI->>Pre : invoke("read-email-list-file", filePath)
Pre->>Main : ipc invoke("read-email-list-file", filePath)
alt CSV
Main->>FS : createReadStream(filePath)
Main->>CSV : pipe stream
CSV-->>Main : "data" rows
Main-->>Pre : joined emails
else TXT
Main->>FS : readFileSync(filePath,"utf8")
Main-->>Pre : joined emails
end
Pre-->>UI : emails
```

### File reading mechanisms: streams vs synchronous
- Streams:
  - Used for CSV parsing via fs.createReadStream and piping to csv-parser
  - Benefits: memory efficient for large files; incremental processing
- Synchronous:
  - Used for TXT parsing via readFileSync
  - Simpler for small files; straightforward line splitting and filtering

```mermaid
flowchart TD
A["File Type"] --> B{"CSV?"}
B --> |Yes| S["Use fs.createReadStream + csv-parser"]
B --> |No| T{"TXT?"}
T --> |Yes| R["Use fs.readFileSync + split/filter"]
T --> |No| E["Unsupported or error"]
```

### Dialog-Based file selection
- WhatsApp contact import dialog:
  - Properties: openFile
  - Filters: Text Files (txt, csv) and All Files
- Email list import dialog:
  - Properties: openFile
  - Filters: Text Files, CSV Files, All Files
- Both dialogs return a result object with canceled flag and filePaths array

### Error handling strategies
- File access failures:
  - Stream errors are captured and handled to avoid crashes; returns empty array
  - Synchronous read errors are caught and return empty array
- Invalid formats:
  - Unsupported file types return null or empty results depending on context
  - CSV parsing handles missing columns gracefully by skipping invalid rows
- Permission issues:
  - Dialog cancellation is handled; UI informs user
  - Exceptions during file read are logged and surfaced to the UI
- Frontend validation:
  - Email list import validates presence of subject, message, and recipient count
  - Regex-based email validation ensures only valid addresses are processed

### Security considerations
- Context isolation and secure IPC:
  - Preload exposes only necessary APIs via contextBridge
  - Electron's contextIsolation enabled in BrowserWindow configuration
- Path handling:
  - No explicit path traversal checks observed; ensure dialogs restrict to intended directories
- Data sanitization:
  - Phone numbers and emails are trimmed and validated before use
  - CSV column detection uses flexible heuristics; consider stricter schema enforcement if needed
- Environment and secrets:
  - Gmail and SMTP credentials are stored securely via electron-store; avoid logging sensitive data

## Dependency analysis
External libraries and their roles:
- whatsapp-web.js: WhatsApp client lifecycle and messaging
- csv-parser: Streaming CSV parsing in main process
- electron-store: Secure credential storage for Gmail/SMTP
- googleapis: Gmail API authentication and sending
- nodemailer: SMTP transport and sending
- qrcode: QR code generation for WhatsApp auth
- react/react-dom: UI framework
- tailwindcss: Styling

```mermaid
graph LR
M["main.js"] --> W["whatsapp-web.js"]
M --> C["csv-parser"]
M --> ES["electron-store"]
M --> QR["qrcode"]
GH["gmail-handler.js"] --> GA["googleapis"]
GH --> ES
SH["smtp-handler.js"] --> NM["nodemailer"]
SH --> ES
```

## Performance considerations
- Prefer streaming for large CSV files to reduce memory usage
- Apply rate limiting and delays when interacting with external services (WhatsApp, Gmail, SMTP)
- Validate and sanitize early to minimize downstream processing overhead
- Avoid blocking the UI thread; keep file operations asynchronous

## Troubleshooting guide
Common issues and resolutions:
- Dialog canceled or no file selected:
  - UI should inform the user and prevent further processing
- Unsupported file type:
  - Ensure file extension matches supported types; return null or empty result
- CSV parsing errors:
  - Verify CSV structure and delimiters; handle missing columns gracefully
- Permission denied:
  - Confirm file permissions and path validity; prompt user to select another file
- Email list validation failures:
  - Ensure recipients contain "@" and are non-empty; display specific invalid entries

## Conclusion
The Electron main process implements reliable file system operations for importing contacts and email lists. It uses Node.js streams for efficient CSV processing, synchronous reads for simple TXT parsing, and secure IPC via preload to expose capabilities to the renderer. Error handling is integrated at multiple layers, and security is addressed through context isolation and secure credential storage. For production hardening, consider adding explicit path validation and stricter CSV schema enforcement.
