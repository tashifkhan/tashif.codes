# SMTP email integration

## Introduction
This page provides detailed documentation for SMTP email integration and configuration within the Bulk Messaging System. It covers SMTP server setup, authentication, connection verification, email composition with HTML support, bulk sending with configurable delays and progress monitoring, provider-specific configurations, and security considerations. The system integrates SMTP email sending alongside other messaging channels (WhatsApp and Gmail API) in a cross-platform Electron application.

## Project structure
The SMTP integration spans the frontend React components and the Electron main process. The frontend provides a user interface for configuring SMTP settings, composing emails, and monitoring progress. The Electron main process handles secure IPC communication, credential storage, and the actual SMTP transport creation and email sending.

```mermaid
graph TB
subgraph "Frontend (React)"
UI_SMTP["SMTPForm.jsx<br/>User interface for SMTP configuration"]
UI_BulkMailer["BulkMailer.jsx<br/>Main application container"]
UI_Gmail["GmailForm.jsx<br/>Gmail interface"]
end
subgraph "Electron Main Process"
Main["main.js<br/>IPC handlers and app lifecycle"]
Preload["preload.js<br/>Secure IPC bridge"]
SMTP_Handler["smtp-handler.js<br/>SMTP transport and sending"]
Gmail_Handler["gmail-handler.js<br/>Gmail API integration"]
end
UI_SMTP --> Preload
UI_BulkMailer --> Preload
UI_Gmail --> Preload
Preload --> Main
Main --> SMTP_Handler
Main --> Gmail_Handler
```

## Core components
- SMTPForm: Provides the UI for SMTP configuration, recipient management, email composition, and sending controls.
- BulkMailer: Orchestrates the application state, form validation, and IPC calls to the Electron main process.
- smtp-handler: Creates the Nodemailer transport, verifies connections, sends emails, and manages progress events.
- main.js: Registers IPC handlers for SMTP operations and manages the Electron application lifecycle.
- preload.js: Exposes a secure API surface to the renderer process for SMTP operations.
- GmailForm and gmail-handler: Provide complementary email sending capabilities via Gmail API for comparison and alternative usage.

## Architecture overview
The SMTP integration follows a layered architecture:
- Frontend Layer: React components manage user input and display progress.
- IPC Layer: Secure inter-process communication via Electron's contextBridge.
- Main Process Layer: Handles SMTP operations, credential storage, and progress reporting.
- Transport Layer: Uses Nodemailer to connect to SMTP servers and send emails.

```mermaid
sequenceDiagram
participant UI as "SMTPForm.jsx"
participant BM as "BulkMailer.jsx"
participant Preload as "preload.js"
participant Main as "main.js"
participant Handler as "smtp-handler.js"
participant SMTP as "SMTP Server"
UI->>BM : User clicks "Send SMTP Email"
BM->>Preload : sendSMTPEmail(smtpData)
Preload->>Main : ipcRenderer.invoke('smtp-send', smtpData)
Main->>Handler : handleSMTPSend(event, smtpData)
Handler->>Handler : Validate configuration
Handler->>Handler : Create Nodemailer transport
Handler->>Handler : Verify connection
loop For each recipient
Handler->>Handler : Create mail options (HTML + text)
Handler->>SMTP : Send email
SMTP-->>Handler : Delivery result
Handler->>Main : Send progress event
Main-->>UI : email-progress
end
Handler-->>Main : Return results
Main-->>Preload : Return results
Preload-->>BM : Return results
BM-->>UI : Update UI with results
```

## Detailed component analysis

### SMTP configuration and form handling
The SMTP configuration UI allows users to set host, port, username/email, password, and secure connection preferences. The form validates that all required fields are present before enabling the send button.

Key configuration aspects:
- Host: SMTP server hostname (e.g., smtp.gmail.com)
- Port: Numeric port (commonly 587 for TLS, 465 for SSL)
- Username/Email: Sender's email address
- Password: Authentication credential
- Secure: Boolean flag for SSL/TLS mode

The form displays configuration status and provides import functionality for email lists.

### SMTP transport creation and connection verification
The SMTP handler creates a Nodemailer transport with the provided configuration and performs a connection verification step before sending emails. It supports both SSL (port 465) and TLS (port 587) modes based on the secure flag.

Connection verification ensures the transport is ready before proceeding with bulk sending, preventing unnecessary failures later in the process.

### Email composition and content handling
Email composition supports HTML content with automatic text/plain conversion. The handler strips HTML tags to create a plain text version for the text part of the email, ensuring compatibility with email clients that do not support HTML.

Features:
- HTML message body
- Automatic text/plain generation from HTML
- Proper MIME structure for multipart emails

### Bulk sending implementation with progress monitoring
The SMTP handler implements a loop to send emails to each recipient with configurable delays. It emits progress events after each send operation, allowing the UI to display real-time status updates.

Progress monitoring includes:
- Current position in the queue
- Total recipient count
- Individual recipient status (sent/failed)
- Error details for failed deliveries

Rate limiting is achieved through configurable delays between emails, helping to avoid spam detection and respecting provider rate limits.

### Credential storage and security
The SMTP handler provides an option to save SMTP configuration to encrypted storage. It stores host, port, secure flag, and username while intentionally omitting the password for security reasons. This enables users to quickly reconfigure subsequent sessions without re-entering sensitive credentials.

Storage behavior:
- Encrypted local storage via electron-store
- Selective credential persistence (excludes password)
- Retrieval of saved configuration for convenience

### Provider-Specific configurations
Provider-specific SMTP configurations are documented in the project README. These configurations help users set up SMTP for popular email services.

Common provider configurations:
- Gmail SMTP: Host smtp.gmail.com, Port 587 (TLS) or 465 (SSL), requires App Password
- Outlook/Hotmail SMTP: Host smtp-mail.outlook.com, Port 587, TLS

These settings guide users in configuring their SMTP credentials correctly for each provider.

### Integration with application lifecycle
The main process registers an IPC handler for SMTP operations and exposes it through the preload bridge. The BulkMailer component coordinates form validation, prepares email data, and manages the sending lifecycle.

Integration points:
- IPC registration for 'smtp-send'
- Secure API exposure via contextBridge
- Form validation and error handling
- Progress event subscription

## Dependency analysis
The SMTP integration relies on several key dependencies and their relationships:

```mermaid
graph TB
subgraph "Application Dependencies"
Electron["electron"]
React["react"]
Nodemailer["nodemailer"]
Store["electron-store"]
GoogleApis["googleapis"]
QRCode["qrcode"]
end
subgraph "SMTP Integration"
SMTP_Handler["smtp-handler.js"]
SMTP_Form["SMTPForm.jsx"]
Bulk_Mailer["BulkMailer.jsx"]
end
SMTP_Handler --> Nodemailer
SMTP_Handler --> Store
Bulk_Mailer --> SMTP_Form
Bulk_Mailer --> Preload["preload.js"]
Preload --> Electron
Gmail_Handler["gmail-handler.js"] --> GoogleApis
Gmail_Handler --> Store
```

## Performance considerations
- Rate limiting: Configurable delays between emails prevent rate limiting and spam detection.
- Connection reuse: Nodemailer transports are reused for the duration of the sending session.
- Progress reporting: Real-time updates minimize perceived latency and improve user experience.
- Memory management: Large recipient lists are processed iteratively to avoid memory pressure.
- Network efficiency: Single SMTP connection handles multiple emails in sequence.

## Troubleshooting guide

### Connection failures
Common causes and solutions:
- Incorrect host/port configuration: Verify provider-specific settings
- Firewall/proxy blocking: Check network connectivity and proxy settings
- DNS resolution issues: Ensure proper DNS configuration
- Self-signed certificate errors: The handler accepts self-signed certificates for development

Diagnostic steps:
- Test SMTP server accessibility using telnet or openssl s_client
- Verify DNS resolution of the SMTP hostname
- Check firewall rules and proxy configurations
- Validate network connectivity to the SMTP server

### Authentication errors
Common causes and solutions:
- Invalid username/password combination
- Disabled SMTP access in email provider settings
- Two-factor authentication requirements
- App-specific password requirements (Gmail)

Diagnostic steps:
- Verify email provider's SMTP settings and authentication requirements
- Test credentials with a known working SMTP client
- Check email provider's security settings for SMTP access
- Ensure correct password type (app-specific vs. regular password for Gmail)

### Delivery issues
Common causes and solutions:
- Invalid recipient addresses
- Email content blocked by spam filters
- Rate limiting by email provider
- Attachment size limits exceeded

Diagnostic steps:
- Validate recipient email formats
- Review email content for spam trigger words
- Adjust rate limiting settings
- Check email provider's attachment policies

### UI and progress issues
Common causes and solutions:
- Progress events not updating in UI
- Delay settings not taking effect
- Form validation preventing send operations

Diagnostic steps:
- Verify IPC event listeners are properly attached
- Check delay configuration values
- Review form validation logic for required fields

## Conclusion
The SMTP email integration provides a reliable, secure, and user-friendly solution for bulk email sending within the Bulk Messaging System. It offers detailed configuration options, real-time progress monitoring, and strong security practices including encrypted credential storage. The integration supports major email providers and includes extensive troubleshooting guidance to ensure reliable email delivery. The modular architecture enables easy maintenance and future enhancements while maintaining cross-platform compatibility.
