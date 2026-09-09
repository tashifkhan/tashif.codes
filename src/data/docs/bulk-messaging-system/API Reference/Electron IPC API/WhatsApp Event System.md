# WhatsApp event system

## Introduction

The WhatsApp Event System is a detailed real-time event emission framework built for the Electron-based bulk messaging application. This system enables smooth communication between the main process (where WhatsApp Web integration occurs) and the renderer process (where the React UI displays real-time status updates).

The system provides three primary event categories:
- **Client Lifecycle Events**: Covering initialization, authentication, and disconnection states
- **QR Code Events**: Managing QR code generation and display for authentication
- **Mass Messaging Events**: Real-time progress tracking during bulk message operations

## System architecture

The event system follows Electron's IPC (Inter-Process Communication) pattern with a clear separation of concerns:

```mermaid
graph TB
subgraph "Renderer Process (UI)"
UI[React Components]
BM[BulkMailer Component]
WF[WhatsAppForm Component]
Preload[Preload Bridge]
end
subgraph "Main Process"
Main[Main Process]
Client[WhatsApp Client]
Events[Event Handlers]
end
subgraph "External Services"
WWeb[WhatsApp Web API]
QR[QR Code Generator]
end
UI --> Preload
Preload --> Main
Main --> Client
Client --> QR
Client --> WWeb
Client --> Events
Events --> Preload
Preload --> UI
style UI fill:#4CAF50
style Main fill:#2196F3
style Client fill:#FF9800
```

## Event types and payloads

### Event categories

The system emits three distinct event types with specific payload characteristics:

#### 1. client lifecycle events (`whatsapp-status`)
- **Purpose**: Real-time status updates for WhatsApp client lifecycle
- **Payload Type**: String message describing current state
- **Frequency**: Variable (as events occur)
- **Timing**: Immediate notification upon state change

#### 2. QR code events (`whatsapp-qr`)
- **Purpose**: QR code data for authentication
- **Payload Type**: Data URL string (image data) or null
- **Frequency**: Generated when QR becomes available
- **Timing**: Generated asynchronously after QR event from client

#### 3. mass messaging events (`whatsapp-send-status`)
- **Purpose**: Progress tracking for bulk message operations
- **Payload Type**: String progress messages
- **Frequency**: Multiple updates per operation
- **Timing**: Real-time during message sending process

## Client lifecycle events

### Event emission flow

The client lifecycle events follow a predictable sequence during WhatsApp client initialization:

```mermaid
sequenceDiagram
participant UI as "UI Layer"
participant Preload as "Preload Bridge"
participant Main as "Main Process"
participant Client as "WhatsApp Client"
participant Events as "Event System"
UI->>Preload : startWhatsAppClient()
Preload->>Main : ipcRenderer.invoke('whatsapp-start-client')
Main->>Events : send('whatsapp-status', 'Initializing...')
Events-->>Preload : 'whatsapp-status' event
Preload-->>UI : onWhatsAppStatus callback
Main->>Client : new Client(LocalAuth)
Main->>Client : whatsappClient.on('qr', handler)
Main->>Client : whatsappClient.on('ready', handler)
Main->>Client : whatsappClient.on('authenticated', handler)
Main->>Client : whatsappClient.on('disconnected', handler)
Client->>Main : emit('qr', qrString)
Main->>Events : send('whatsapp-status', 'Scan QR code')
Main->>Main : QRCode.toDataURL(qrString)
Main->>Events : send('whatsapp-qr', dataUrl)
Events-->>Preload : 'whatsapp-qr' event
Preload-->>UI : onWhatsAppQR callback
Client->>Main : emit('ready')
Main->>Events : send('whatsapp-status', 'Client is ready!')
Main->>Events : send('whatsapp-qr', null)
Events-->>Preload : 'whatsapp-status' event
Events-->>Preload : 'whatsapp-qr' event (null)
Preload-->>UI : onWhatsAppStatus & onWhatsAppQR callbacks
```

### Lifecycle states

The system manages the following client states:

| State | Description | Event Emission |
|-------|-------------|----------------|
| `Initializing` | Client creation and setup | `whatsapp-status` with initialization message |
| `Starting` | Client initialization process | `whatsapp-status` with start message |
| `Waiting for QR` | Client ready, waiting for QR code | `whatsapp-status` with QR instruction |
| `Authenticated` | Successful authentication | `whatsapp-status` with success message |
| `Ready` | Client fully operational | `whatsapp-status` with readiness message |
| `Disconnected` | Client lost connection | `whatsapp-status` with disconnection reason |

## QR code events

### QR code generation process

The QR code system operates through a two-stage process:

```mermaid
flowchart TD
Start([QR Event Received]) --> Generate["Generate Data URL"]
Generate --> ValidateQR{"QR String Valid?"}
ValidateQR --> |Yes| SendQR["Send QR Data URL"]
ValidateQR --> |No| ErrorQR["Emit Error Status"]
SendQR --> ClearQR["Clear QR Display"]
ErrorQR --> EmitError["Emit Error Message"]
ClearQR --> End([QR Event Complete])
EmitError --> End
subgraph "QR Processing"
QRGen[QRCode.toDataURL(qr)]
DataURL[Data URL String]
end
Generate --> QRGen
QRGen --> DataURL
DataURL --> SendQR
```

### QR code payload schema

| Property | Type | Description | Example |
|----------|------|-------------|---------|
| `qr` | String | QR code string from WhatsApp client | `"0AKCD..."` |
| `dataUrl` | String \| null | Base64 encoded image data | `"data:image/png;base64,iVBOR..."` |
| `status` | String | Current authentication status | `"Scan QR code"` |

### QR code display integration

The UI component handles QR code display with reliable error handling:

```mermaid
stateDiagram-v2
[*] --> Initializing
Initializing --> WaitingForQR : QR Event
WaitingForQR --> QRReceived : Data URL
WaitingForQR --> QRFailed : Error
QRReceived --> Authenticated : Successful Scan
QRReceived --> QRFailed : Load Error
QRFailed --> Initializing : Retry
Authenticated --> Ready : Client Operational
Ready --> Disconnected : Connection Lost
Disconnected --> Initializing : Reconnect
```

## Mass messaging events

### Event emission pattern

The mass messaging system provides granular progress tracking:

```mermaid
sequenceDiagram
participant UI as "UI Layer"
participant Preload as "Preload Bridge"
participant Main as "Main Process"
participant Client as "WhatsApp Client"
UI->>Preload : sendWhatsAppMessages(data)
Preload->>Main : ipcRenderer.invoke('whatsapp-send-messages', data)
Main->>Preload : send('whatsapp-send-status', 'Starting...')
Preload-->>UI : Progress update
loop For each contact
Main->>Client : isRegisteredUser(chatId)
alt Registered
Main->>Client : sendMessage(chatId, message)
Main->>Preload : send('whatsapp-send-status', 'Sent to +1234567890')
Main->>Main : Wait 3 seconds
else Not Registered
Main->>Preload : send('whatsapp-send-status', 'Failed : +1234567890 not registered')
Main->>Main : Wait 5 seconds
end
end
Main->>Preload : send('whatsapp-send-status', 'Complete : Sent : X, Failed : Y')
Preload-->>UI : Final progress update
```

### Progress event payloads

| Event Type | Payload Format | Purpose |
|------------|----------------|---------|
| `whatsapp-send-status` | `"Sending messages to N contacts..."` | Operation start |
| `whatsapp-send-status` | `"Sent to +1234567890"` | Individual success |
| `whatsapp-send-status` | `"Failed: +1234567890 not registered"` | Registration failure |
| `whatsapp-send-status` | `"Failed to send to +1234567890: Error message"` | General failure |
| `whatsapp-send-status` | `"Mass messaging complete. Sent: X, Failed: Y"` | Operation completion |

## Event listener implementation

### Renderer process integration

The event listeners are implemented in the BulkMailer component with proper cleanup:

```mermaid
classDiagram
class BulkMailer {
+useState waStatus
+useState waQR
+useState waResults
+useEffect setupListeners()
+startWhatsAppClient()
+logoutWhatsApp()
+sendWhatsAppBulk()
-cleanupListeners()
}
class EventListeners {
+onWhatsAppStatus(callback)
+onWhatsAppQR(callback)
+onWhatsAppSendStatus(callback)
+removeListener()
}
class WhatsAppForm {
+props waStatus
+props waQR
+props waResults
+renderStatusIndicator()
+renderQRDisplay()
+renderActivityLog()
}
BulkMailer --> EventListeners : "manages"
BulkMailer --> WhatsAppForm : "passes props"
EventListeners --> BulkMailer : "callback functions"
```

### Listener registration pattern

The event listeners follow a consistent registration and cleanup pattern:

```javascript
// Event listener setup
const removeWaStatus = window.electronAPI.onWhatsAppStatus((_, status) =>
    setWaStatus(status)
);

const removeWaQR = window.electronAPI.onWhatsAppQR((_, qr) =>
    setWaQR(qr)
);

const removeWaSendStatus = window.electronAPI.onWhatsAppSendStatus(
    (_, msg) => {
        setWaStatus(msg);
        setWaResults(prev => [...prev, msg]);
    }
);

// Cleanup on component unmount
return () => {
    if (removeWaStatus) removeWaStatus();
    if (removeWaQR) removeWaQR();
    if (removeWaSendStatus) removeWaSendStatus();
};
```

## State management integration

### React state synchronization

The event system integrates smoothly with React's state management:

```mermaid
flowchart LR
subgraph "Event Flow"
Evt[Event Emitted] --> Handler[Event Handler]
Handler --> State[React State Update]
State --> Render[UI Re-render]
end
subgraph "State Variables"
Status[waStatus]
QR[waQR]
Results[waResults]
Contacts[waContacts]
Message[waMessage]
end
Handler --> Status
Handler --> QR
Handler --> Results
Status --> UI[WhatsAppForm UI]
QR --> UI
Results --> UI
Contacts --> UI
Message --> UI
```

### UI component state mapping

| Event Type | State Variable | UI Impact |
|------------|----------------|-----------|
| `whatsapp-status` | `waStatus` | Updates status indicator, loading states |
| `whatsapp-qr` | `waQR` | Displays QR code or clears display |
| `whatsapp-send-status` | `waResults` | Adds progress entries to activity log |
| `whatsapp-send-status` | `waStatus` | Updates current operation status |

## Event ordering and concurrency

### Event ordering guarantees

The system maintains strict event ordering through several mechanisms:

1. **Sequential Event Processing**: Events are processed in the order they are emitted
2. **State Consistency**: React state updates ensure UI reflects current state
3. **Cleanup Mechanisms**: Proper listener cleanup prevents stale event handling

### Concurrency considerations

The system handles concurrent operations safely:

```mermaid
graph TB
subgraph "Concurrent Operations"
Msg1[Message 1 Processing]
Msg2[Message 2 Processing]
Msg3[Message 3 Processing]
end
subgraph "Event Queue"
Q1[Progress Event 1]
Q2[Progress Event 2]
Q3[Progress Event 3]
end
subgraph "UI Rendering"
UI1[UI Update 1]
UI2[UI Update 2]
UI3[UI Update 3]
end
Msg1 --> Q1 --> UI1
Msg2 --> Q2 --> UI2
Msg3 --> Q3 --> UI3
style Msg1 fill:#4CAF50
style Msg2 fill:#FF9800
style Msg3 fill:#2196F3
```

### Race condition prevention

The system prevents race conditions through:

- **Single Client Instance**: Only one WhatsApp client instance is maintained
- **Sequential Message Processing**: Messages are sent one at a time with delays
- **Proper Cleanup**: Event listeners are removed when components unmount

## Error handling and propagation

### Error propagation pattern

Errors propagate through the system with appropriate handling:

```mermaid
flowchart TD
Error[Error Occurs] --> MainErr[Main Process Error]
MainErr --> StatusEvt[whatsapp-status Event]
StatusEvt --> UI[UI Update]
subgraph "Error Types"
InitErr[Initialization Error]
AuthErr[Authentication Error]
SendErr[Message Send Error]
QRGenErr[QR Generation Error]
end
InitErr --> StatusEvt
AuthErr --> StatusEvt
SendErr --> StatusEvt
QRGenErr --> StatusEvt
```

### Error handling strategies

| Error Type | Handler | Response |
|------------|---------|----------|
| Initialization Failure | `whatsapp-status` | Error message with details |
| Authentication Failure | `whatsapp-status` | Failure reason and cleanup |
| QR Generation Failure | `whatsapp-status` | Error message and fallback |
| Message Send Failure | `whatsapp-send-status` | Individual failure report |
| Client Disconnection | `whatsapp-status` | Disconnection reason and reset |

## Performance considerations

### Event frequency optimization

The system optimizes event frequency to balance responsiveness with performance:

- **QR Events**: Minimal frequency (only when QR becomes available)
- **Status Events**: Moderate frequency (state transitions)
- **Progress Events**: High frequency during bulk operations (every 3-5 seconds)

### Memory management

The system implements several memory management strategies:

- **Automatic Cleanup**: Event listeners are removed on component unmount
- **Client Instance Management**: Single client instance prevents memory leaks
- **QR Data Handling**: QR images are cleared when no longer needed

### Rate limiting implementation

The mass messaging system includes built-in rate limiting:

- **3-second delay** for registered users
- **5-second delay** for failed attempts
- **Individual contact processing** prevents overwhelming the API

## Memory leak prevention

### Listener cleanup pattern

The system implements detailed listener cleanup:

```mermaid
sequenceDiagram
participant Comp as "Component Mount"
participant List as "Event Listeners"
participant Clean as "Cleanup Function"
Comp->>List : Register listeners
List->>Comp : Return cleanup function
Comp->>Clean : Store cleanup function
Note over Comp : Component Unmounts
Comp->>Clean : Call cleanup function
Clean->>List : Remove all listeners
List->>Comp : Listeners removed
```

### Cleanup implementation

The cleanup mechanism ensures no memory leaks:

```javascript
// Cleanup function returned by listener registration
const removeWaStatus = window.electronAPI.onWhatsAppStatus((_, status) =>
    setWaStatus(status)
);

// Component unmount cleanup
return () => {
    if (removeWaStatus) removeWaStatus();
    if (removeWaQR) removeWaQR();
    if (removeWaSendStatus) removeWaSendStatus();
};
```

## Troubleshooting guide

### Common issues and solutions

| Issue | Symptoms | Solution |
|-------|----------|----------|
| QR Code Not Loading | Blank QR area, error message | Check network connectivity, retry connection |
| Authentication Fails | Repeated authentication failures | Clear cached authentication files, restart client |
| Messages Not Sending | Progress shows failures | Check contact registration, verify message format |
| UI Not Updating | Status remains static | Verify event listeners are registered, check console errors |

### Debugging event flow

To debug event flow issues:

1. **Enable Developer Tools**: Use `mainWindow.webContents.openDevTools()`
2. **Monitor Console Output**: Check for error messages in main process
3. **Verify Event Registration**: Ensure listeners are properly registered
4. **Test Individual Events**: Isolate specific event types for testing

### Performance monitoring

Monitor system performance through:

- **Event Frequency**: Track event emission rates
- **Memory Usage**: Monitor renderer process memory consumption
- **UI Responsiveness**: Measure UI update latency
- **Error Rates**: Track error occurrence frequency

## Conclusion

The WhatsApp Event System provides a reliable, real-time communication framework between the Electron main process and renderer process. Through carefully designed event types, proper state management integration, and detailed error handling, the system delivers reliable WhatsApp Web integration with excellent user experience.

Key strengths of the system include:

- **Predictable Event Flow**: Clear lifecycle management with proper ordering guarantees
- **Real-time Updates**: Immediate UI feedback for all user actions
- **Error Resilience**: Detailed error handling with graceful degradation
- **Performance Optimization**: Efficient event processing with rate limiting
- **Memory Safety**: Automatic cleanup prevents memory leaks
- **Extensible Design**: Modular architecture supports future enhancements

The system successfully balances functionality with reliability, providing users with a smooth WhatsApp bulk messaging experience while maintaining system stability and performance.
