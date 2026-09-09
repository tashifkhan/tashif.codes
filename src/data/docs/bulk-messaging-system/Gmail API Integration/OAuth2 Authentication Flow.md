# OAuth2 authentication flow

## Introduction
This page provides detailed documentation for the Gmail OAuth2 authentication implementation in the desktop application. It covers the complete OAuth2 flow including client ID/secret configuration, consent screen setup, redirect URI handling, browser window implementation for OAuth2 consent, token exchange and storage, and troubleshooting for common issues. The implementation uses Electron's main/preload process model, Google APIs client library, and secure local storage via electron-store.

## Project structure
The Gmail OAuth2 implementation spans three primary areas:
- Electron main process: IPC registration and orchestration
- Preload script: Secure IPC bridge exposing safe APIs to the renderer
- Renderer components: UI integration and user interaction

```mermaid
graph TB
subgraph "Electron Application"
MW["Main Window<br/>main.js"]
PG["Preload Bridge<br/>preload.js"]
GF["Gmail UI<br/>GmailForm.jsx"]
BM["App Container<br/>BulkMailer.jsx"]
end
subgraph "Authentication Flow"
GH["Gmail Handler<br/>gmail-handler.js"]
GA["Google OAuth2 API"]
ES["electron-store<br/>Local Token Storage"]
end
BM --> GF
GF --> PG
PG --> MW
MW --> GH
GH --> GA
GH --> ES
```

## Core components
The OAuth2 implementation consists of four core components working together:

### 1. gmail handler (authentication engine)
The central authentication module that manages OAuth2 lifecycle:
- Validates environment credentials
- Generates OAuth2 URLs with proper scopes
- Manages browser window for consent
- Handles token exchange and storage
- Implements timeout and error management

### 2. main process IPC registration
Registers all authentication-related IPC handlers:
- `gmail-auth`: Initiates OAuth2 flow
- `gmail-token`: Checks token availability
- `send-email`: Sends emails using stored credentials

### 3. preload bridge
Provides secure access to authentication APIs:
- Exposes `authenticateGmail`, `getGmailToken`, `sendEmail`
- Bridges renderer to main process safely
- Handles progress events for email sending

### 4. UI integration
Two-way integration between UI and authentication:
- Authentication button triggers OAuth2 flow
- Token status displayed in UI
- Progress tracking during email sending

## Architecture overview
The OAuth2 flow follows a secure, multi-process architecture designed to isolate sensitive operations in the main process while maintaining a responsive UI.

```mermaid
sequenceDiagram
participant UI as "GmailForm.jsx"
participant Preload as "preload.js"
participant Main as "main.js"
participant Handler as "gmail-handler.js"
participant Browser as "BrowserWindow"
participant Google as "Google OAuth2 API"
UI->>Preload : authenticateGmail()
Preload->>Main : ipcRenderer.invoke('gmail-auth')
Main->>Handler : handleGmailAuth()
Handler->>Handler : validate env credentials
Handler->>Google : generateAuthUrl(scopes, prompt)
Handler->>Browser : create BrowserWindow
Browser->>Google : load auth URL
UI->>Browser : user completes consent
Browser->>Handler : redirect to callback URL
Handler->>Google : getToken(authorization_code)
Google-->>Handler : access_token + refresh_token
Handler->>Handler : store.set('gmail_token', token)
Handler-->>Main : {success : true}
Main-->>Preload : {success : true}
Preload-->>UI : authentication result
```

## Detailed component analysis

### Gmail handler implementation
The authentication engine implements a reliable OAuth2 flow with detailed error handling and timeout management.

#### Configuration and initialization
- **Scopes**: Requested scope is `https://www.googleapis.com/auth/gmail.send`
- **Redirect URI**: `http://localhost:3000/oauth/callback`
- **Prompt Parameter**: Uses `consent` to ensure refresh token acquisition
- **Access Type**: Offline access for long-term token usage

#### Authentication URL generation
The handler generates OAuth2 URLs with:
- Proper scope specification for Gmail send permissions
- Consent prompt to guarantee refresh token retrieval
- Offline access type for persistent authentication

#### Browser window implementation
The implementation creates a dedicated browser window for OAuth2 consent:
- **Security Settings**: Node integration disabled, context isolation enabled
- **Window Size**: 800x800 pixels for optimal consent screen display
- **Show Policy**: Hidden until ready-to-show event for smooth UX
- **Timeout Handling**: 5-minute timeout prevents hanging windows

#### Redirect handling and token exchange
The handler monitors redirects and processes authentication responses:
- **Callback Detection**: Watches for URLs starting with configured redirect URI
- **Error Extraction**: Parses OAuth error parameters from redirect URL
- **Authorization Code Extraction**: Retrieves code parameter for token exchange
- **Token Exchange**: Uses Google APIs client to exchange code for tokens
- **Credential Storage**: Stores tokens securely using electron-store

#### Timeout and error management
Detailed error handling ensures graceful failure scenarios:
- **Authentication Timeout**: Closes window after 5 minutes
- **Window Closure**: Handles user-initiated window closure
- **Network Errors**: Catches and reports token exchange failures
- **Consent Screen Errors**: Processes OAuth error responses

```mermaid
flowchart TD
Start([Authentication Request]) --> CheckEnv["Check Environment Variables"]
CheckEnv --> EnvValid{"Credentials Valid?"}
EnvValid --> |No| ReturnError["Return Error Response"]
EnvValid --> |Yes| CreateClient["Create OAuth2 Client"]
CreateClient --> GenerateURL["Generate Auth URL<br/>with Scopes & Prompt"]
GenerateURL --> CreateWindow["Create Browser Window<br/>with Security Settings"]
CreateWindow --> LoadAuth["Load OAuth2 Consent Page"]
LoadAuth --> WaitRedirect["Wait for Redirect<br/>or Timeout"]
WaitRedirect --> RedirectDetected{"Redirect to Callback?"}
RedirectDetected --> |No & Timeout| TimeoutError["Authentication Timeout"]
RedirectDetected --> |No & Window Closed| WindowClosed["Window Closed Early"]
RedirectDetected --> |Yes| ExtractParams["Extract Authorization Code/Error"]
ExtractParams --> HasError{"OAuth Error?"}
HasError --> |Yes| ReturnOAuthError["Return OAuth Error"]
HasError --> |No| ExchangeToken["Exchange Code for Tokens"]
ExchangeToken --> TokenSuccess{"Token Exchange<br/>Successful?"}
TokenSuccess --> |No| TokenError["Token Exchange Error"]
TokenSuccess --> |Yes| StoreToken["Store Token in electron-store"]
StoreToken --> CloseWindow["Close Browser Window"]
CloseWindow --> Success["Return Success Response"]
TimeoutError --> Cleanup["Cleanup & Return Error"]
WindowClosed --> Cleanup
ReturnError --> Cleanup
ReturnOAuthError --> Cleanup
TokenError --> Cleanup
Cleanup --> End([End])
Success --> End
```

### Main process IPC integration
The main process registers and handles all authentication-related IPC operations with proper error propagation.

#### IPC handler registration
- **`gmail-auth`**: Primary authentication handler
- **`gmail-token`**: Token availability checker
- **`send-email`**: Email sending with stored credentials

#### Error propagation
All handlers return structured responses with success flags and error details, enabling reliable UI feedback.

### Preload bridge security model
The preload script implements a secure IPC bridge that exposes only necessary authentication APIs to the renderer process.

#### Exposed APIs
- **Authentication**: `authenticateGmail()`, `getGmailToken()`
- **Email Operations**: `sendEmail()`
- **Event Listeners**: Progress tracking for email operations

#### Security features
- **Context Isolation**: Prevents direct Node.js access from renderer
- **Selective Exposure**: Only authentication-related APIs exposed
- **IPC Validation**: All renderer-to-main calls use explicit IPC channels

### UI integration components
The UI components provide smooth user interaction with the authentication system.

#### GmailForm component
- **Authentication Button**: Triggers OAuth2 flow with proper error handling
- **Status Display**: Shows authentication status with visual indicators
- **Progress Tracking**: Displays real-time email sending progress
- **Validation**: Detailed form validation before sending

#### BulkMailer integration
- **Token Checking**: Automatically checks authentication status on load
- **Error Handling**: Graceful handling of missing Electron APIs
- **User Feedback**: Clear alerts for authentication success/failure
- **Form Validation**: Email format validation and recipient count verification

## Dependency analysis
The OAuth2 implementation relies on several key dependencies and external services.

```mermaid
graph TB
subgraph "Application Dependencies"
GA["googleapis<br/>v150.0.1"]
ES["electron-store<br/>v10.1.0"]
EL["electron<br/>v35.1.4"]
RN["react<br/>v19.0.0"]
end
subgraph "External Services"
GC["Google Cloud Console"]
GA_API["Gmail API"]
OAUTH["OAuth2 Consent Screen"]
end
GH["gmail-handler.js"] --> GA
GH --> ES
GH --> EL
GF["GmailForm.jsx"] --> RN
BM["BulkMailer.jsx"] --> RN
GH --> GC
GC --> GA_API
GC --> OAUTH
```

### External dependencies
- **googleapis**: Provides OAuth2 client implementation and Gmail API integration
- **electron-store**: Handles secure local token storage
- **electron**: Main process and BrowserWindow for OAuth2 consent
- **react**: UI components for user interaction

### Google cloud configuration
The implementation requires specific Google Cloud Console setup:
- OAuth2 Client ID (Desktop application)
- Enabled Gmail API
- Proper OAuth2 consent screen configuration
- Correct redirect URI setup

## Performance considerations
The OAuth2 implementation includes several performance optimizations and considerations:

### Token reuse
- Stored tokens eliminate repeated authentication prompts
- OAuth2 client reinitialization only when necessary
- Efficient token validation reduces unnecessary API calls

### Rate limiting
- Configurable delays between email sends prevent rate limiting
- Progress tracking enables user control over sending speed
- Batch processing with controlled intervals

### Memory management
- Browser windows closed after authentication completion
- Timeout cleanup prevents memory leaks
- Proper error handling ensures resource cleanup

## Troubleshooting guide

### Common OAuth2 issues and solutions

#### Invalid client credentials
**Symptoms**: Authentication fails immediately with credential errors
**Causes**: Missing or incorrect GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET
**Solutions**:
- Verify environment variables are set correctly
- Confirm Google Cloud Console project configuration
- Ensure OAuth2 client credentials match project settings

#### Consent screen errors
**Symptoms**: OAuth error responses during consent process
**Causes**: Mismatched redirect URIs, invalid scopes, or user rejection
**Solutions**:
- Verify redirect URI matches Google Cloud Console configuration
- Check scope permissions and user consent
- Ensure proper OAuth2 consent screen setup

#### Token exchange failures
**Symptoms**: Authentication succeeds but token retrieval fails
**Causes**: Network issues, expired authorization codes, or API errors
**Solutions**:
- Retry authentication process
- Check network connectivity
- Verify Google APIs are enabled in project

#### Authentication timeout
**Symptoms**: Window closes after 5 minutes without user interaction
**Causes**: Slow network, blocked pop-ups, or user inactivity
**Solutions**:
- Ensure popup blockers are disabled
- Check network connectivity
- Retry authentication with improved conditions

#### Token storage issues
**Symptoms**: Authentication works but tokens aren't persisted
**Causes**: electron-store initialization errors or permission issues
**Solutions**:
- Verify electron-store installation
- Check application data directory permissions
- Restart application to refresh storage

### Environment setup checklist
1. **Google Cloud Console Configuration**:
   - Create project and enable Gmail API
   - Configure OAuth2 consent screen
   - Create Desktop OAuth2 client ID
   - Download and place credentials JSON

2. **Environment Variables**:
   ```env
   GOOGLE_CLIENT_ID=your_client_id_here
   GOOGLE_CLIENT_SECRET=your_client_secret_here
   ```

3. **Redirect URI Configuration**:
   - Ensure redirect URI matches `http://localhost:3000/oauth/callback`
   - Verify in Google Cloud Console OAuth2 client settings

4. **Application Permissions**:
   - Grant necessary Gmail permissions
   - Verify user account has Gmail access
   - Check for domain restrictions if applicable

## Conclusion
The Gmail OAuth2 authentication implementation provides a secure, reliable, and user-friendly solution for desktop email integration. The multi-process architecture ensures sensitive operations remain isolated while maintaining a responsive user experience. Key strengths include detailed error handling, timeout management, secure token storage, and smooth UI integration. The implementation follows OAuth2 best practices with proper scope management, consent screen handling, and refresh token acquisition for persistent authentication.

## Appendices

### Step-by-Step Google cloud console setup
1. Navigate to Google Cloud Console
2. Create a new project or select existing one
3. Enable the Gmail API for the project
4. Go to "Credentials" → "Create Credentials" → "OAuth 2.0 Client IDs"
5. Select "Desktop application" as application type
6. Download the JSON file containing client credentials
7. Configure OAuth2 consent screen with required scopes
8. Set redirect URI to `http://localhost:3000/oauth/callback`
9. Copy client ID and secret to environment variables

### Environment variable configuration
Create a `.env` file in the electron directory:
```env
GOOGLE_CLIENT_ID=your_client_id_here
GOOGLE_CLIENT_SECRET=your_client_secret_here
```

### Security best practices
- Store client secrets securely in environment variables
- Use offline access type for long-term token persistence
- Implement proper timeout handling to prevent hanging sessions
- Validate all user inputs before initiating authentication
- Use HTTPS for production deployments when applicable
