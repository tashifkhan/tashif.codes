# WhatsApp IPC handlers

## Introduction
This page provides detailed technical documentation for the WhatsApp-related Inter-Process Communication (IPC) handlers in the desktop application. It covers the implementation of four key handlers: `whatsapp-start-client`, `whatsapp-send-messages`, `whatsapp-import-contacts`, and `whatsapp-logout`. The documentation includes client initialization parameters, authentication strategy configuration, Puppeteer browser settings, contact array schema, message personalization patterns, rate limiting implementation, file dialog configuration, supported formats, contact data structure, session cleanup procedures, cache deletion, parameter validation, error handling patterns, return value schemas, and WhatsApp Web API integration specifics including QR code generation and authentication flow.

## Project structure
The WhatsApp IPC handlers are implemented in the Electron main process and exposed to the renderer process through a secure context bridge. The relevant components are organized as follows:
- Electron main process: defines IPC handlers and manages the WhatsApp client lifecycle
- Preload script: exposes a controlled API surface to the renderer process
- React components: provide UI controls and manage state for WhatsApp operations
- Python utilities: support contact parsing and validation

```mermaid
graph TB
subgraph "Renderer Process"
UI["WhatsAppForm.jsx<br/>BulkMailer.jsx"]
Preload["preload.js"]
end
subgraph "Main Process"
Main["main.js"]
WWeb["whatsapp-web.js"]
QR["qrcode"]
FS["fs"]
CSV["csv-parser"]
end
UI --> Preload
Preload --> Main
Main --> WWeb
Main --> QR
Main --> FS
Main --> CSV
```

## Core components
This section documents the four WhatsApp IPC handlers and their associated functionality.

### whatsapp-start-client handler
Purpose: Initialize and connect to WhatsApp Web via a local authentication strategy with a headless browser.

Key Implementation Details:
- Client Initialization Parameters:
  - Authentication Strategy: LocalAuth for persistent session management
  - Puppeteer Configuration:
    - Headless mode enabled for background operation
    - Chromium arguments optimized for Electron environments (sandboxing, GPU disabling, single-process mode)
- Authentication Flow:
  - Emits status events: Initializing WhatsApp client, Starting WhatsApp client, Scan QR code to authenticate, Client is ready, Authenticated, Authentication failed, Client disconnected
  - Generates QR code data URLs and emits them to the renderer process for display
- Error Handling:
  - Catches initialization failures and reports them via status events

Return Value Schema:
- No explicit return value; status updates are sent via events

### whatsapp-send-messages handler
Purpose: Send personalized bulk messages to a list of contacts.

Key Implementation Details:
- Input Parameters:
  - contacts: Array of contact objects with number and optional name
  - messageText: String containing the template message with {{name}} placeholder
- Contact Array Schema:
  - Each contact object requires:
    - number: String representing the phone number
    - name: Optional string for personalization
- Message Personalization:
  - Replaces {{name}} with contact.name or defaults to "Friend" if not provided
- Rate Limiting:
  - Implements delays between sends:
    - 3 seconds after successful send
    - 5 seconds after failure
- Chat ID Construction:
  - Converts phone numbers to WhatsApp chat IDs:
    - If number starts with "+", removes "+" and appends "@c.us"
    - Otherwise appends "@c.us"
- Delivery Validation:
  - Checks user registration status before sending
  - Emits detailed status updates for each operation
- Error Handling:
  - Catches errors per contact and continues with remaining contacts
  - Emits failure status with error details

Return Value Schema:
- Object with success flag, sent count, and failed count

### whatsapp-import-contacts handler
Purpose: Import contacts from file dialogs supporting CSV and TXT formats.

Key Implementation Details:
- File Dialog Configuration:
  - Opens file selection dialog with filters for text files and CSV files
  - Supports all file types as a fallback
- Supported Formats:
  - CSV: Uses streaming parser to process rows
  - TXT: Splits by newline and comma to extract number and optional name
- Contact Data Structure:
  - Each contact object includes:
    - number: Trimmed phone number
    - name: Optional trimmed name (null if not provided)
- Error Handling:
  - Returns empty array on parsing errors
  - Returns null when no file is selected

Return Value Schema:
- Array of contact objects or null

### whatsapp-logout handler
Purpose: Terminate the WhatsApp session and clean up cached authentication data.

Key Implementation Details:
- Session Cleanup Procedures:
  - Calls client.logout() to disconnect from WhatsApp
  - Sets the client reference to null
- Cache Deletion:
  - Removes.wwebjs_cache directory
  - Removes.wwebjs_auth directory
- Status Updates:
  - Emits Disconnected status
  - Clears QR code data
- Error Handling:
  - Attempts cleanup even if logout fails
  - Forces client cleanup and returns appropriate success/failure status

Return Value Schema:
- Object with success flag and message

## Architecture overview
The WhatsApp IPC architecture integrates the renderer UI with the Electron main process and the WhatsApp Web API through the following sequence:

```mermaid
sequenceDiagram
participant UI as "WhatsAppForm.jsx"
participant BM as "BulkMailer.jsx"
participant Preload as "preload.js"
participant Main as "main.js"
participant WWeb as "whatsapp-web.js"
participant QR as "qrcode"
participant FS as "fs"
Note over UI,BM : User initiates WhatsApp operations
UI->>BM : startWhatsAppClient()
BM->>Preload : electronAPI.startWhatsAppClient()
Preload->>Main : ipcRenderer.invoke('whatsapp-start-client')
Main->>WWeb : new Client(LocalAuth)
Main->>WWeb : client.initialize()
WWeb-->>Main : qr event
Main->>QR : QRCode.toDataURL(qr)
QR-->>Main : dataUrl
Main->>UI : emit 'whatsapp-qr', dataUrl
UI-->>UI : Display QR code
Note over Main,WWeb : Authentication flow
WWeb-->>Main : ready/authenticated event
Main->>UI : emit 'whatsapp-status', 'Client is ready!'
Main->>UI : emit 'whatsapp-qr', null
UI->>BM : sendWhatsAppBulk()
BM->>Preload : electronAPI.sendWhatsAppMessages(data)
Preload->>Main : ipcRenderer.invoke('whatsapp-send-messages', data)
Main->>WWeb : isRegisteredUser(chatId)
WWeb-->>Main : registration status
Main->>WWeb : sendMessage(chatId, personalizedMessage)
Main->>UI : emit 'whatsapp-send-status', progress
Main-->>Preload : {success, sent, failed}
Preload-->>BM : result
BM-->>UI : Update status/results
UI->>BM : logoutWhatsApp()
BM->>Preload : electronAPI.logoutWhatsApp()
Preload->>Main : ipcRenderer.invoke('whatsapp-logout')
Main->>WWeb : client.logout()
Main->>FS : delete .wwebjs_cache/.wwebjs_auth
Main->>UI : emit 'whatsapp-status', 'Disconnected'
Main->>UI : emit 'whatsapp-qr', null
Main-->>Preload : {success, message}
Preload-->>BM : result
BM-->>UI : Reset UI state
```

## Detailed component analysis

### WhatsApp client lifecycle management
The main process manages the complete lifecycle of the WhatsApp client, including initialization, authentication, and cleanup.

```mermaid
stateDiagram-v2
[*] --> Uninitialized
Uninitialized --> Initializing : startWhatsAppClient()
Initializing --> WaitingForQR : client.initialize()
WaitingForQR --> Authenticated : qr event
WaitingForQR --> Disconnected : auth_failure/disconnected
Authenticated --> Ready : ready/authenticated event
Ready --> Disconnected : disconnected event
Disconnected --> Uninitialized : cleanup/logout
```

### Message sending algorithm
The message sending process implements a reliable pipeline with validation and rate limiting.

```mermaid
flowchart TD
Start([Function Entry]) --> ValidateClient["Validate WhatsApp Client"]
ValidateClient --> ClientReady{"Client Ready?"}
ClientReady --> |No| ReturnError["Return Error Response"]
ClientReady --> |Yes| IterateContacts["Iterate Through Contacts"]
IterateContacts --> ExtractContact["Extract {number, name}"]
ExtractContact --> Personalize["Replace {{name}} in message"]
Personalize --> BuildChatId["Build chatId from number"]
BuildChatId --> CheckRegistration["Check isRegisteredUser"]
CheckRegistration --> Registered{"User Registered?"}
Registered --> |No| MarkFailed["Mark as Failed"]
Registered --> |Yes| SendMessage["Send Message"]
SendMessage --> DelaySuccess["Wait 3 seconds"]
DelaySuccess --> NextContact["Next Contact"]
MarkFailed --> DelayFail["Wait 5 seconds"]
DelayFail --> NextContact
NextContact --> MoreContacts{"More Contacts?"}
MoreContacts --> |Yes| IterateContacts
MoreContacts --> |No| EmitSummary["Emit Completion Summary"]
EmitSummary --> ReturnSuccess["Return {success, sent, failed}"]
ReturnError --> End([Function Exit])
ReturnSuccess --> End
```

### Contact import processing
The contact import handler supports multiple file formats with consistent output structure.

```mermaid
flowchart TD
Start([Function Entry]) --> ShowDialog["Show File Dialog"]
ShowDialog --> HasFile{"File Selected?"}
HasFile --> |No| ReturnNull["Return null"]
HasFile --> |Yes| DetectFormat["Detect File Extension"]
DetectFormat --> IsCSV{"Extension is .csv?"}
IsCSV --> |Yes| StreamCSV["Stream CSV with csv-parser"]
IsCSV --> |No| IsTXT{"Extension is .txt?"}
IsTXT --> |Yes| ReadTXT["Read and Split TXT Lines"]
IsTXT --> |No| Unsupported["Throw Error"]
StreamCSV --> ParseCSV["Parse Rows to Contacts"]
ReadTXT --> ParseTXT["Split by ',' to Extract Number/Name"]
ParseCSV --> CollectContacts["Collect Valid Contacts"]
ParseTXT --> CollectContacts
CollectContacts --> ReturnContacts["Return Contacts Array"]
Unsupported --> HandleError["Return Empty Array"]
ReturnNull --> End([Function Exit])
ReturnContacts --> End
HandleError --> End
```

### Parameter validation patterns
The application implements detailed validation across different components:

```mermaid
classDiagram
class ContactValidation {
+validateContact(contact) boolean
+extractPhoneNumber(input) string
+formatPhoneNumber(phone) string
-validateFormat(phone) boolean
}
class MessageValidation {
+validateMessage(message) boolean
+checkTemplateVariables(message) boolean
+sanitizeMessage(message) string
}
class FileValidation {
+validateCSVHeaders(headers) boolean
+validateTXTFormat(lines) boolean
+detectEncoding(buffer) string
}
class NumberParser {
+parseManualNumbers(text) Contact[]
+extractNameAndNumber(line) NameNumber
-cleanPhoneNumber(phone) string
}
ContactValidation --> NumberParser : "uses"
MessageValidation --> ContactValidation : "validates"
FileValidation --> ContactValidation : "validates"
```

## Dependency analysis
The WhatsApp IPC handlers rely on several external libraries and internal components:

```mermaid
graph TB
subgraph "External Dependencies"
WWeb["whatsapp-web.js v1.30.0"]
QR["qrcode v1.5.4"]
CSV["csv-parser"]
FS["fs"]
Path["path"]
Dialog["dialog"]
end
subgraph "Internal Components"
Main["main.js"]
Preload["preload.js"]
Utils["utils.js"]
Form["WhatsAppForm.jsx"]
Mailer["BulkMailer.jsx"]
PyUtils["pyodide.js"]
PyParser["parse_manual_numbers.py"]
end
Main --> WWeb
Main --> QR
Main --> CSV
Main --> FS
Main --> Path
Main --> Dialog
Preload --> Main
Form --> Preload
Mailer --> Preload
Mailer --> PyUtils
PyUtils --> PyParser
Utils --> Main
```

## Performance considerations
The application implements several performance optimizations and rate limiting strategies:

- Browser Optimization: Puppeteer runs in headless mode with Chromium arguments designed for Electron environments, reducing memory footprint and improving stability.
- Network Efficiency: QR code generation uses efficient base64 encoding and streaming file processing for large CSV files.
- Rate Limiting: Configured delays (3 seconds for success, 5 seconds for failure) help prevent rate limiting and improve reliability.
- Memory Management: Proper cleanup of client instances and file system resources prevents memory leaks.
- Asynchronous Processing: Streaming CSV parsing and asynchronous message sending prevent UI blocking.

## Troubleshooting guide
Common issues and their resolutions:

### Authentication problems
- QR Code Not Loading: Check network connectivity and restart the application. The system attempts to regenerate QR codes on error.
- Authentication Failures: Verify that the device is linked to WhatsApp Web and that the QR code is scanned within the timeout period.

### Message delivery issues
- Rate Limiting: The system implements automatic delays between sends. Excessive failures may indicate rate limiting by WhatsApp.
- Registration Check Failures: Some numbers may not be registered on WhatsApp. The system checks registration status before sending.

### File import problems
- CSV Parsing Errors: Ensure CSV files have proper headers and encoding. The system uses streaming parsing for large files.
- TXT Format Issues: Verify that TXT files use comma separation for number/name pairs.

### Session management
- Logout Issues: The system attempts cleanup even if logout fails. Forced cleanup ensures no stale authentication data remains.

## Conclusion
The WhatsApp IPC handlers provide a reliable foundation for bulk messaging through WhatsApp Web. The implementation includes detailed authentication flow management, flexible contact import capabilities, intelligent message personalization, and resilient error handling. The architecture balances performance with reliability through careful rate limiting, proper resource cleanup, and efficient file processing. The modular design allows for easy extension and maintenance while maintaining security through the Electron context isolation model.
