# Authentication and delivery troubleshooting

## Introduction
This page provides a detailed troubleshooting guide for Gmail API integration issues within the desktop application. It focuses on authentication failures (invalid client credentials, consent screen errors, OAuth2 flow interruptions), email sending problems (rate limit violations, API quota exceeded errors, delivery failures), and platform-specific considerations for Windows, macOS, and Linux. It also covers debugging techniques using console logs, network inspection, and API response analysis, along with step-by-step resolution guides for certificate issues, proxy configuration, and network connectivity problems. Security-related troubleshooting for blocked applications and suspicious activity warnings is included.

## Project structure
The application is an Electron-based desktop app with a React frontend and Node/Electron backend. Gmail integration is handled in the Electron main process via the Google APIs client library, while the UI provides authentication and sending controls.

```mermaid
graph TB
subgraph "Frontend (React)"
UI_Gmail["GmailForm.jsx"]
UI_BulkMailer["BulkMailer.jsx"]
Preload["preload.js"]
end
subgraph "Electron Main Process"
Main["main.js"]
GmailHandler["gmail-handler.js"]
SMTPHandler["smtp-handler.js"]
end
subgraph "External Services"
GoogleAPIs["Google APIs (Gmail)"]
SMTPServer["SMTP Server"]
end
UI_Gmail --> Preload
UI_BulkMailer --> Preload
Preload --> Main
Main --> GmailHandler
Main --> SMTPHandler
GmailHandler --> GoogleAPIs
SMTPHandler --> SMTPServer
```

## Core components
- Gmail authentication and token management: Handles OAuth2 flow, consent screen, and token persistence.
- Email sending pipeline: Sends emails via Gmail API with progress reporting and rate limiting.
- SMTP transport: Alternative email delivery method with connection verification and TLS handling.
- Frontend integration: UI components for authentication, recipient import, and progress monitoring.

Key implementation references:
- Gmail OAuth2 flow and token exchange: `gmail-handler.js`
- Gmail send operation and per-recipient progress: `gmail-handler.js`
- SMTP transport creation and verification: `smtp-handler.js`
- Frontend IPC exposure and event listeners: `preload.js`
- Electron main process IPC registration: `main.js`

## Architecture overview
The application uses Electron's contextBridge to securely expose IPC methods to the renderer. The main process registers handlers for Gmail authentication, token retrieval, and email sending. The Gmail handler manages OAuth2, opens a browser window for consent, captures the authorization code, exchanges it for tokens, and persists them. The UI triggers these flows and displays progress events.

```mermaid
sequenceDiagram
participant UI as "GmailForm.jsx"
participant BM as "BulkMailer.jsx"
participant Preload as "preload.js"
participant Main as "main.js"
participant GH as "gmail-handler.js"
participant Browser as "BrowserWindow"
participant Google as "Google OAuth2"
UI->>BM : "Click Authenticate Gmail"
BM->>Preload : "invoke('gmail-auth')"
Preload->>Main : "IPC gmail-auth"
Main->>GH : "handleGmailAuth()"
GH->>GH : "validate env vars"
GH->>GH : "create OAuth2 client"
GH->>Google : "generateAuthUrl(scope=send)"
GH->>Browser : "load auth URL"
Browser-->>GH : "redirect to localhost : 3000/oauth/callback?code=..."
GH->>GH : "exchange code for token"
GH->>GH : "store token"
GH-->>Main : "{success : true}"
Main-->>Preload : "{success : true}"
Preload-->>BM : "{success : true}"
BM-->>UI : "update auth status"
```

## Detailed component analysis

### Gmail authentication handler
Implements OAuth2 authorization, consent screen handling, and token exchange. Logs environment variable checks, redirect handling, and error propagation.

```mermaid
flowchart TD
Start(["handleGmailAuth"]) --> CheckEnv["Check GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET"]
CheckEnv --> EnvOK{"Environment valid?"}
EnvOK --> |No| ReturnErr["Return error: missing env vars"]
EnvOK --> |Yes| CreateOAuth["Create OAuth2 client with REDIRECT_URI"]
CreateOAuth --> GenAuthUrl["Generate auth URL with scope 'gmail.send' and prompt 'consent'"]
GenAuthUrl --> OpenBrowser["Open BrowserWindow and load auth URL"]
OpenBrowser --> WaitRedirect["Listen for will-redirect"]
WaitRedirect --> RedirectURI{"URL starts with REDIRECT_URI?"}
RedirectURI --> |No| WaitRedirect
RedirectURI --> |Yes| ExtractParams["Extract 'code' or 'error'"]
ExtractParams --> HasError{"Has 'error' param?"}
HasError --> |Yes| LogOAuthErr["Log OAuth error"] --> ReturnOAuthErr["Return {success:false, error}"]
HasError --> |No| HasCode{"Has 'code' param?"}
HasCode --> |No| NoCodeErr["Log no code received"] --> ReturnNoCode["Return {success:false, error}"]
HasCode --> |Yes| ExchangeToken["oauth2Client.getToken(code)"]
ExchangeToken --> TokenOK{"Token exchange success?"}
TokenOK --> |No| TokenErr["Log token exchange error"] --> ReturnTokenErr["Return {success:false, error}"]
TokenOK --> |Yes| SetCreds["Set credentials and store token"]
SetCreds --> CloseWindow["Close BrowserWindow"]
CloseWindow --> Done(["Resolve {success:true}"])
```

### Gmail send handler
Handles bulk email sending via Gmail API, including per-recipient progress updates and rate limiting.

```mermaid
sequenceDiagram
participant UI as "GmailForm.jsx"
participant BM as "BulkMailer.jsx"
participant Preload as "preload.js"
participant Main as "main.js"
participant GH as "gmail-handler.js"
participant GmailAPI as "Gmail API"
UI->>BM : "Click Send Bulk Email"
BM->>Preload : "invoke('send-email', payload)"
Preload->>Main : "IPC send-email"
Main->>GH : "handleSendEmail(event, payload)"
GH->>GH : "load stored token"
GH->>GH : "create gmail client with token"
GH->>GH : "loop recipients"
GH->>GmailAPI : "users.messages.send(raw)"
GmailAPI-->>GH : "response"
GH->>Preload : "emit 'email-progress' per recipient"
GH-->>Main : "{success : true, results}"
Main-->>Preload : "{success : true, results}"
Preload-->>BM : "{success : true, results}"
BM-->>UI : "update results"
```

### SMTP transport handler
Provides SMTP-based email sending with connection verification and TLS configuration.

```mermaid
flowchart TD
Start(["handleSMTPSend"]) --> ValidateCfg["Validate SMTP config (host, port, user, pass)"]
ValidateCfg --> CfgOK{"Config valid?"}
CfgOK --> |No| ReturnCfgErr["Return {success:false, error:'Incomplete SMTP configuration'}"]
CfgOK --> |Yes| CreateTransport["Create Nodemailer transport with TLS settings"]
CreateTransport --> VerifyConn["transporter.verify()"]
VerifyConn --> VerifyOK{"Connection verified?"}
VerifyOK --> |No| ReturnVerifyErr["Return {success:false, error}"]
VerifyOK --> |Yes| LoopRecipients["For each recipient"]
LoopRecipients --> SendMail["transporter.sendMail(options)"]
SendMail --> SendOK{"Send success?"}
SendOK --> |No| PushFail["Push {status:'failed', error}"] --> EmitFail["emit 'email-progress' failed"]
SendOK --> |Yes| PushSuccess["Push {status:'sent'}"] --> EmitSuccess["emit 'email-progress' sent"]
EmitFail --> Delay["Apply delay if not last"]
EmitSuccess --> Delay
Delay --> NextRecipient["Next recipient"]
NextRecipient --> LoopRecipients
LoopRecipients --> Done(["Return {success:true, results}"])
```

## Dependency analysis
- Electron main process registers IPC handlers for Gmail and SMTP operations.
- Frontend uses contextBridge to invoke handlers and listen for progress events.
- Gmail integration depends on googleapis and electron-store for token persistence.
- SMTP integration depends on nodemailer and electron-store for optional configuration persistence.

```mermaid
graph LR
Preload["preload.js"] --> Main["main.js"]
Main --> GmailHandler["gmail-handler.js"]
Main --> SMTPHandler["smtp-handler.js"]
GmailHandler --> GoogleAPIs["googleapis"]
SMTPHandler --> Nodemailer["nodemailer"]
GmailHandler --> ElectronStore["electron-store"]
SMTPHandler --> ElectronStore
```

## Performance considerations
- Rate limiting: Both Gmail and SMTP handlers apply configurable delays between emails to avoid throttling and spam detection.
- Progress reporting: Real-time updates per recipient improve user feedback and help diagnose slow endpoints.
- Connection verification: SMTP handler verifies transport configuration before sending to reduce runtime failures.

[No sources needed since this section provides general guidance]

## Troubleshooting guide

### Authentication failures

Common symptoms:
- Missing environment variables for client credentials.
- Consent screen errors or OAuth error callbacks.
- Authentication window closes unexpectedly or times out.

Diagnostic steps:
- Verify environment variables are present and correct in the Electron process.
- Check the generated OAuth URL and consent screen behavior.
- Inspect redirect handling and captured parameters.
- Review timeout behavior and window lifecycle events.

Resolution steps:
- Confirm GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are set and accessible to the Electron process.
- Ensure the OAuth consent screen is configured for a desktop application and includes the required scopes.
- Validate the redirect URI matches the registered OAuth client configuration.
- Increase timeout if the consent flow takes longer than 5 minutes.
- Re-run authentication after correcting credentials or consent configuration.

Relevant implementation references:
- Environment variable checks and error returns: `gmail-handler.js`
- OAuth URL generation with consent prompt: `gmail-handler.js`
- Redirect handling and authorization code extraction: `gmail-handler.js`
- Timeout handling and window closure: `gmail-handler.js`

### OAuth2 flow interruptions

Common symptoms:
- Redirect URL mismatch or unexpected parameters.
- Missing authorization code or presence of OAuth error.
- Window closed before completion.

Diagnostic steps:
- Capture and log the redirect URL and query parameters.
- Check for 'error' parameter presence and value.
- Verify the authorization code is extracted and exchanged successfully.

Resolution steps:
- Align redirect URI with OAuth client configuration.
- Ensure the consent screen grants the required scope.
- Retry authentication if interrupted; avoid closing the browser window prematurely.

Relevant implementation references:
- Redirect URL capture and parameter extraction: `gmail-handler.js`
- Error parameter handling: `gmail-handler.js`
- Authorization code exchange: `gmail-handler.js`

### Email sending problems

Common symptoms:
- Rate limit violations or throttling.
- Delivery failures per recipient.
- Network connectivity or TLS certificate issues.

Diagnostic steps:
- Monitor 'email-progress' events for per-recipient statuses.
- Inspect error messages attached to failed events.
- Verify SMTP connection verification passes before sending.
- Check TLS settings and certificate rejection policies.

Resolution steps:
- Increase delay between emails to respect provider limits.
- For Gmail API, ensure sufficient quota and consider upgrading or scheduling sends.
- For SMTP, adjust host/port/security settings and test connection verification.
- For certificate issues, review TLS configuration and consider disabling unauthorized certificate rejection only for testing.

Relevant implementation references:
- Progress emission and per-recipient updates: `gmail-handler.js`, `smtp-handler.js`
- SMTP connection verification: `smtp-handler.js`
- TLS settings for SMTP: `smtp-handler.js`

### Platform-Specific issues (windows, macOS, linux)

Common symptoms:
- Application fails to start or load resources.
- Certificate or proxy issues on corporate networks.
- File system permissions affecting token storage.

Diagnostic steps:
- Check Electron app initialization and resource loading paths.
- Verify environment variables and file permissions for token storage.
- Test network connectivity and proxy settings.

Resolution steps:
- Ensure the app is built and distributed for the target platform using electron-builder configurations.
- On Linux/macOS, confirm proper sandbox and security settings for file access.
- On Windows, verify executable permissions and antivirus interference.
- Configure proxies if required by the environment; ensure HTTPS proxy support.

Relevant implementation references:
- Electron app lifecycle and resource loading: `main.js`
- Build targets for distribution: `README.md`, `electron-builder.json`

### Certificate issues and proxy configuration

Symptoms:
- TLS handshake failures or certificate errors.
- SMTP connection timeouts behind corporate proxies.

Resolution steps:
- For SMTP, temporarily adjust TLS settings to accept unauthorized certificates for testing; revert to strict verification in production.
- Configure system or application-level proxy settings to allow outbound connections to Google APIs and SMTP servers.
- Validate that the proxy supports HTTPS and maintains session continuity.

Relevant implementation references:
- SMTP TLS configuration: `smtp-handler.js`

### Network connectivity problems

Symptoms:
- Authentication redirects fail to reach localhost callback.
- Gmail API calls time out or fail.
- SMTP verification hangs or fails.

Resolution steps:
- Verify local firewall allows inbound traffic on the OAuth redirect port.
- Test DNS resolution and connectivity to external endpoints.
- Use network tracing tools to inspect request/response flows and identify blocking endpoints.

Relevant implementation references:
- OAuth redirect URI and browser window handling: `gmail-handler.js`
- Browser window lifecycle and timeout: `gmail-handler.js`

### Security-Related troubleshooting

Symptoms:
- Suspicious activity warnings or blocked application notifications.
- OAuth consent screen rejecting the application.

Resolution steps:
- Ensure the OAuth client is configured for desktop application type and includes the required scopes.
- Review Google Cloud Console settings and API enablement.
- Follow Google's guidelines for OAuth application verification and security practices.

Relevant implementation references:
- OAuth scope and consent prompt configuration: `gmail-handler.js`

### Debugging techniques

Console logs:
- Use Electron DevTools to inspect logs from the main process and renderer.
- Monitor authentication and send operations for error messages and timing.

Network inspection:
- Use browser developer tools to inspect OAuth redirects and network requests.
- For SMTP, monitor connection verification and send operations.

API response analysis:
- Examine error messages returned by handlers and surface them to the UI.
- Track per-recipient statuses and error details in the activity log.

Relevant implementation references:
- Frontend IPC listeners and alerts: `BulkMailer.jsx`, `BulkMailer.jsx`, `BulkMailer.jsx`
- Progress event emission: `gmail-handler.js`, `smtp-handler.js`

## Conclusion
This guide consolidates practical troubleshooting strategies for Gmail API and SMTP integration within the Electron application. By validating credentials, ensuring proper OAuth consent, monitoring progress events, and addressing platform-specific and network conditions, most authentication and delivery issues can be resolved efficiently. Use the referenced implementation files to correlate observed symptoms with code-level diagnostics and apply the recommended resolutions.
