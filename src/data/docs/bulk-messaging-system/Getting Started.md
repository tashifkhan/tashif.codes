# Getting started

## Introduction
This guide helps you set up and run the WhatsappBulkMessaging desktop application. It covers prerequisites, installation, environment configuration, initial setup, quick start examples for each messaging service, troubleshooting, and verification steps. The application combines an Electron + React frontend with a Python backend for advanced contact processing.

## Prerequisites
Ensure your system meets these requirements before installing:
- Node.js 16 or newer
- Python 3.8 or newer
- Google Cloud Console access for Gmail API
- A WhatsApp account
- SMTP server credentials (if using SMTP method)

These prerequisites are documented in the project's Getting Started section.

## Installation
Follow these step-by-step instructions to install the application:

1. Clone the repository:
   ```bash
   git clone https://github.com/tashifkhan/bulk-messaging-system
   cd WhatsappBulkMessaging
   ```

2. Install Electron dependencies:
   ```bash
   cd electron
   npm install
   ```

3. Install Python backend dependencies:
   ```bash
   cd ../python-backend
   pip install -r requirements.txt
   ```

4. Start the development server:
   ```bash
   # From the electron directory
   npm run dev
   ```

This starts both the React development server and the Electron main process concurrently.

## Environment configuration
Configure environment variables for Gmail API authentication:

1. Create a `.env` file in the `electron` directory with your Google OAuth2 credentials:
   ```
   GOOGLE_CLIENT_ID=your_client_id_here
   GOOGLE_CLIENT_SECRET=your_client_secret_here
   ```

2. Follow the Gmail API setup steps in the project documentation to create credentials and enable the Gmail API.

These configurations enable secure OAuth2 authentication for Gmail API integration.

## Initial setup workflow
Connect to WhatsApp using QR code authentication:

1. Open the application and navigate to the WhatsApp tab.
2. Click "Connect to WhatsApp".
3. Scan the QR code displayed in the app using your phone's WhatsApp.
4. Wait for authentication to complete.

The Electron main process manages the WhatsApp client lifecycle, handles QR generation, and emits status updates to the renderer.

```mermaid
sequenceDiagram
participant UI as "WhatsAppForm.jsx"
participant Preload as "preload.js"
participant Main as "main.js"
participant WA as "whatsapp-web.js"
UI->>Preload : startWhatsAppClient()
Preload->>Main : invoke("whatsapp-start-client")
Main->>WA : new Client(LocalAuth)
WA-->>Main : qr event
Main-->>UI : emit("whatsapp-qr", dataUrl)
UI-->>UI : display QR code
WA-->>Main : ready/authenticated events
Main-->>UI : emit("whatsapp-status", "ready/Authenticated")
```

## Quick start examples
### WhatsApp messaging
1. Connect to WhatsApp using the QR code workflow described above.
2. Import contacts via CSV/Excel or add numbers manually.
3. Compose your message, optionally using `{{name}}` for personalization.
4. Set a delay between messages and click "Send Mass Messages".

The Electron main process sends messages using the WhatsApp Web client and reports progress.

### Gmail API
1. Navigate to the Gmail tab.
2. Click "Authenticate Gmail" to open the OAuth consent flow.
3. After successful authentication, import or enter email addresses.
4. Compose your email (subject and HTML content supported).
5. Set the delay between emails and click "Send Bulk Email".

The Gmail handler manages OAuth2 flow and sends emails via the Gmail API.

### SMTP
1. Navigate to the SMTP tab.
2. Enter your SMTP server configuration (host, port, username, password).
3. Optionally enable secure connection (SSL/TLS).
4. Import or enter email addresses.
5. Compose your email and set the delay between emails.
6. Click "Send SMTP Email".

The SMTP handler validates configuration, connects to the server, and sends emails.

## Architecture overview
The application follows a hybrid architecture combining Electron + React for the UI and Python for backend utilities.

```mermaid
graph TB
subgraph "Desktop App (Electron)"
UI[React UI]
Preload[preload.js]
Main[main.js]
Handlers[gmail-handler.js<br/>smtp-handler.js]
end
subgraph "Messaging Services"
WA[whatsapp-web.js]
Gmail[Gmail API]
SMTP[Nodemailer]
end
subgraph "Python Backend"
PyAPI[Flask API]
Utils[Contact Processing]
end
UI --> Preload
Preload --> Main
Main --> Handlers
Handlers --> WA
Handlers --> Gmail
Handlers --> SMTP
UI --> PyAPI
PyAPI --> Utils
```

## Detailed component analysis

### Electron main process
The main process orchestrates:
- Window creation and development vs production loading
- IPC handlers for Gmail, SMTP, and WhatsApp
- WhatsApp client lifecycle (init, QR, ready, authenticated, disconnected)
- Contact import and email list parsing

```mermaid
flowchart TD
Start([App Start]) --> CreateWindow["Create BrowserWindow<br/>with preload context"]
CreateWindow --> RegisterHandlers["Register IPC Handlers<br/>Gmail | SMTP | WhatsApp"]
RegisterHandlers --> InitWhatsApp["Initialize WhatsApp Client<br/>LocalAuth + Puppeteer"]
InitWhatsApp --> QR["On QR Event<br/>Generate Data URL"]
InitWhatsApp --> Ready["On Ready/Auth Events<br/>Clear QR, Emit Status"]
InitWhatsApp --> Disconnected["On Disconnect<br/>Cleanup Session"]
QR --> UI["Renderer Receives QR"]
Ready --> UI
```

### Gmail handler
Handles OAuth2 authentication and email sending:
- Validates environment variables
- Opens browser window for consent
- Exchanges authorization code for tokens
- Stores tokens securely
- Sends emails with progress reporting

```mermaid
sequenceDiagram
participant UI as "GmailForm.jsx"
participant Preload as "preload.js"
participant Handler as "gmail-handler.js"
participant Google as "Google OAuth2"
participant GmailAPI as "Gmail API"
UI->>Preload : authenticateGmail()
Preload->>Handler : invoke("gmail-auth")
Handler->>Google : generateAuthUrl()
Handler->>Google : getToken(code)
Handler->>Handler : store.set("gmail_token")
UI->>Preload : sendEmail(emailData)
Preload->>Handler : invoke("send-email")
Handler->>GmailAPI : users.messages.send()
Handler-->>UI : progress events
```

### SMTP handler
Manages SMTP configuration and sending:
- Validates SMTP config
- Saves credentials securely (excluding password)
- Verifies connection
- Sends emails with rate limiting and progress reporting

### Python backend API
Provides contact processing utilities:
- Upload and parse CSV/Excel/Text files
- Clean and validate phone numbers
- Parse manually entered numbers
- Validate individual numbers

## Dependency analysis
Key dependencies and their roles:

```mermaid
graph LR
subgraph "Electron Dependencies"
React[react@^19]
Tailwind[tailwindcss@^4]
WA[whatsapp-web.js@^1.30]
Nodemailer[nodemailer@^7]
Googleapis[googleapis@^150]
end
subgraph "Python Dependencies"
Flask[flask]
Pandas[pandas]
Openpyxl[openpyxl]
Werkzeug[werkzeug]
end
React --> WA
React --> Nodemailer
React --> Googleapis
WA -.-> Python[python-backend]
Nodemailer -.-> Python
Googleapis -.-> Python
```

## Troubleshooting guide
Common installation and runtime issues:

- **WhatsApp QR Code Not Loading**
  - Check internet connection
  - Restart the application
  - Clear browser cache

- **Gmail Authentication Failed**
  - Verify OAuth2 credentials
  - Check Google Cloud Console settings
  - Ensure Gmail API is enabled

- **SMTP Connection Issues**
  - Verify server settings
  - Check firewall settings
  - Use correct port and security settings

- **Contact Import Errors**
  - Check file format compatibility
  - Verify file encoding (UTF-8)
  - Ensure proper column headers

Additional checks:
- Confirm Node.js 16+ and Python 3.8+ are installed
- Ensure environment variables are correctly set
- Verify development server runs on port 5173

## Verification steps
After completing setup, verify your installation:

1. **Development Server**
   - Confirm the React dev server starts on port 5173
   - Check Electron main process logs for successful window creation

2. **WhatsApp Connection**
   - Launch the app and connect to WhatsApp
   - Verify QR code appears and authenticates successfully
   - Check status updates in the activity log

3. **Gmail API**
   - Authenticate with Gmail
   - Send a test email to yourself
   - Review progress in the activity log

4. **SMTP**
   - Configure SMTP settings
   - Send a test email
   - Confirm delivery status

5. **Python Backend**
   - Start the Flask API
   - Test contact parsing endpoints
   - Verify response formats

## Next steps
Once verified, explore advanced features:
- Customize message templates
- Configure rate limiting and delays
- Export sending results and statistics
- Integrate with external contact management systems
- Package the application for distribution using electron-builder

Build targets are configured for macOS, Windows, and Linux distributions.
