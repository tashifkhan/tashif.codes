# Web push service

## Introduction
The Web Push Service is a core component of the SuperSet Telegram Notification Bot that enables real-time browser notifications through the Web Push protocol with VAPID (Voluntary Application Server Identification) authentication. This service integrates smoothly with the multi-channel notification ecosystem alongside Telegram notifications, providing users with instant updates delivered directly to their web browsers.

The service implements a detailed notification delivery mechanism that includes subscription management, payload formatting, VAPID encryption, and reliable error handling for delivery failures. It operates as part of a larger system that monitors multiple data sources (SuperSet portal, email notifications, official websites) and distributes notifications through various channels to registered users.

## Project structure
The Web Push Service is organized within the application's modular architecture, following service-oriented design principles with clear separation of concerns:

```mermaid
graph TB
subgraph "Application Layer"
WS[WebPushService]
NS[NotificationService]
TS[TelegramService]
end
subgraph "Server Layer"
WH[WebhookServer]
BS[BotServer]
end
subgraph "Infrastructure"
DB[(MongoDB)]
VAPID[VAPID Keys]
PYWP[pywebpush Library]
end
WS --> DB
NS --> WS
NS --> TS
WH --> WS
WH --> NS
WS --> VAPID
WS --> PYWP
TS --> DB
```

## Core components
The Web Push Service consists of several interconnected components that work together to provide reliable browser notification delivery:

### WebPushService class
The primary service class that implements the INotificationChannel protocol, handling all aspects of web push notification delivery including VAPID authentication, subscription management, and payload formatting.

### VAPID authentication system
Implements Voluntary Application Server Identification for secure push notification delivery, requiring cryptographic keys and contact email for authentication with push providers.

### Subscription management
Manages user subscriptions through the database service, storing subscription endpoints and cryptographic keys associated with each user's browser installations.

### Notification delivery pipeline
Processes notification requests through a structured pipeline that formats payloads, applies VAPID signatures, and handles delivery failures with automatic cleanup of invalid subscriptions.

## Architecture overview
The Web Push Service operates within a detailed notification architecture that supports multiple delivery channels:

```mermaid
sequenceDiagram
participant Client as "Web Browser"
participant Server as "Webhook Server"
participant Service as "WebPushService"
participant DB as "DatabaseService"
participant Provider as "Push Provider"
Note over Client,Provider : Subscription Registration
Client->>Server : POST /api/push/subscribe
Server->>Service : save_subscription()
Service->>DB : Store subscription data
DB-->>Service : Confirmation
Service-->>Server : Success
Server-->>Client : {"success" : true}
Note over Client,Provider : Notification Delivery
Client->>Server : GET /api/push/vapid-key
Server-->>Client : {"publicKey" : "..."}
Note over Client,Provider : Message Broadcasting
Server->>Service : broadcast_to_all_users()
Service->>DB : Get active users
DB-->>Service : User subscriptions
Service->>Provider : Send push notifications
Provider-->>Service : Delivery status
Service->>DB : Remove invalid subscriptions
Service-->>Server : Delivery statistics
Server-->>Client : {"success" : true, "results" : {...}}
```

The architecture ensures smooth integration between web browsers and the notification system, with automatic handling of subscription lifecycle management and delivery failures.

## Detailed component analysis

### VAPID encryption implementation
The Web Push Service implements VAPID (Voluntary Application Server Identification) encryption for secure notification delivery:

```mermaid
classDiagram
class WebPushService {
-str vapid_private_key
-str vapid_public_key
-str vapid_email
-DatabaseService db_service
-bool _enabled
+send_message(message, **kwargs) bool
+broadcast_to_all_users(message, **kwargs) Dict
+save_subscription(user_id, subscription) bool
+get_public_key() str
-_send_push(subscription, title, message) bool
-_remove_subscription(subscription) void
}
class VAPIDClaims {
+str sub
+str aud
+int exp
}
class PushPayload {
+str title
+str body
+str icon
+str badge
+Dict data
}
WebPushService --> VAPIDClaims : "creates"
WebPushService --> PushPayload : "formats"
```

The VAPID implementation includes:
- **Private Key Management**: Cryptographic key for signing push requests
- **Public Key Distribution**: Shared with web clients for subscription verification
- **Claims Generation**: Creation of authentication claims with contact email
- **Signature Validation**: Verification of push provider authentication

### Browser subscription management
The service manages browser subscriptions through a structured lifecycle:

```mermaid
stateDiagram-v2
[*] --> Registered
Registered --> Active : Successful Delivery
Active --> Expired : 404/410 Response
Active --> Disabled : User Unsubscribes
Expired --> Removed : Cleanup Process
Disabled --> Active : Re-subscription
Removed --> Registered : New Registration
note right of Active
- Delivery successful
- Subscription valid
- Provider responds 200 OK
end note
note right of Expired
- Delivery failed
- Subscription invalid/expired
- Provider responds 404/410
end note
```

Subscription management includes:
- **Registration**: Storing subscription endpoints and cryptographic keys
- **Validation**: Periodic verification of subscription validity
- **Cleanup**: Automatic removal of expired or invalid subscriptions
- **Persistence**: Database storage of subscription data linked to user profiles

### Push notification delivery mechanisms
The notification delivery pipeline follows a standardized process:

```mermaid
flowchart TD
Start([Notification Request]) --> ValidateConfig["Validate VAPID Configuration"]
ValidateConfig --> ConfigOK{"Configuration Valid?"}
ConfigOK --> |No| SkipDelivery["Skip Delivery<br/>Return Success"]
ConfigOK --> |Yes| LoadSubscriptions["Load User Subscriptions"]
LoadSubscriptions --> HasSubs{"Has Subscriptions?"}
HasSubs --> |No| ReturnSuccess["Return Success<br/>No Subscriptions"]
HasSubs --> |Yes| FormatPayload["Format Notification Payload"]
FormatPayload --> SignVAPID["Apply VAPID Signature"]
SignVAPID --> SendPush["Send to Push Provider"]
SendPush --> CheckResponse{"Delivery Success?"}
CheckResponse --> |Yes| Success["Increment Success Count"]
CheckResponse --> |No| CheckStatus{"HTTP 404/410?"}
CheckStatus --> |Yes| RemoveSub["Remove Invalid Subscription"]
CheckStatus --> |No| LogError["Log Error"]
RemoveSub --> NextSub["Next Subscription"]
LogError --> NextSub
Success --> NextSub
NextSub --> MoreSubs{"More Subscriptions?"}
MoreSubs --> |Yes| SendPush
MoreSubs --> |No| ReturnResults["Return Delivery Statistics"]
SkipDelivery --> End([End])
ReturnSuccess --> End
ReturnResults --> End
```

### Integration with multi-channel notification ecosystem
The Web Push Service integrates with the broader notification ecosystem:

```mermaid
graph LR
subgraph "Data Sources"
SS[SuperSet Portal]
EM[Email System]
OW[Official Website]
end
subgraph "Processing Layer"
PS[PlacementService]
ES[EmailNoticeService]
FS[NoticeFormatterService]
end
subgraph "Storage"
DB[(MongoDB)]
end
subgraph "Distribution"
NS[NotificationService]
TS[TelegramService]
WS[WebPushService]
end
subgraph "Clients"
TG[Telegram Users]
WB[Web Browsers]
end
SS --> PS
EM --> ES
OW --> PS
PS --> FS
ES --> FS
FS --> DB
DB --> NS
NS --> TS
NS --> WS
TS --> TG
WS --> WB
```

## Dependency analysis
The Web Push Service relies on several key dependencies for secure and reliable operation:

```mermaid
graph TB
subgraph "Core Dependencies"
PYWP[pywebpush 2.2.0]
VAPID[py-vapid 1.9.4]
CRYPTO[cryptography 46.0.3]
HTTP_ECE[http-ece 1.2.1]
end
subgraph "Framework Dependencies"
FASTAPI[FastAPI 0.128.0]
UVICORN[uvicorn 0.40.0]
REQUESTS[requests 2.32.5]
PYMONGO[pymongo 4.14.1]
end
subgraph "Application Dependencies"
CONFIG[Pydantic Settings]
DOTENV[python-dotenv]
APSCHED[APScheduler 3.11.2]
end
PYWP --> VAPID
PYWP --> CRYPTO
PYWP --> HTTP_ECE
PYWP --> REQUESTS
FASTAPI --> STARLETTE
UVICORN --> FASTAPI
```

The dependency graph reveals a sophisticated stack designed for production reliability:
- **pywebpush**: Core library for Web Push protocol implementation
- **py-vapid**: VAPID signature generation and validation
- **cryptography**: Underlying cryptographic operations
- **http-ece**: HTTP Encrypted Content Encoding for payload encryption
- **FastAPI/uvicorn**: Modern asynchronous web framework for API endpoints

## Performance considerations
The Web Push Service is designed with several performance optimizations:

### Asynchronous processing
- **Non-blocking Operations**: Webhook server uses FastAPI with async capabilities
- **Connection Pooling**: Efficient database connections through PyMongo
- **Batch Processing**: Multiple subscriptions processed in parallel where safe

### Resource management
- **Lazy Loading**: Optional dependency loading prevents runtime errors
- **Memory Efficiency**: Payload truncation and streaming where applicable
- **Connection Reuse**: Database connections maintained throughout service lifetime

### Scalability features
- **Graceful Degradation**: Service continues operating even without VAPID keys
- **Error Isolation**: Individual subscription failures don't impact others
- **Automatic Cleanup**: Invalid subscriptions removed to prevent performance degradation

## Troubleshooting guide

### Common VAPID configuration issues
**Problem**: Web push notifications not working despite proper setup
**Solution**: Verify VAPID key configuration and provider compatibility

**Problem**: Subscription registration failing with HTTP 501
**Solution**: Check VAPID key availability and service initialization

**Problem**: Delivery failures with 404/410 responses
**Solution**: Automatic cleanup removes invalid subscriptions; verify subscription validity

### Subscription management issues
**Problem**: Subscriptions not persisting in database
**Solution**: Verify database connectivity and user ID mapping

**Problem**: Duplicate subscriptions accumulating
**Solution**: Implement subscription deduplication logic in database service

### Performance issues
**Problem**: Slow notification delivery
**Solution**: Monitor database query performance and optimize subscription retrieval

**Problem**: Memory leaks during high-volume delivery
**Solution**: Implement proper resource cleanup and connection pooling

## Conclusion
The Web Push Service represents a reliable implementation of browser notification delivery within the SuperSet Telegram Notification Bot ecosystem. Its architecture demonstrates best practices in service-oriented design, security implementation, and scalability considerations.

The service successfully bridges the gap between traditional Telegram notifications and modern web browser capabilities, providing users with flexible notification delivery options. The VAPID implementation ensures secure communication with push providers, while the subscription management system maintains clean, valid subscription lists.

Key strengths of the implementation include:
- **Security**: Detailed VAPID encryption and authentication
- **Reliability**: Graceful degradation and automatic error recovery
- **Scalability**: Efficient batch processing and resource management
- **Integration**: Smooth coordination with the broader notification ecosystem

Future enhancements could include WebSocket support for real-time bidirectional communication, expanded browser compatibility testing, and advanced analytics for delivery performance monitoring.

## Appendices

### Configuration requirements
The Web Push Service requires specific environment variables for proper operation:

| Variable | Description | Required | Example |
|----------|-------------|----------|---------|
| VAPID_PRIVATE_KEY | Private key for VAPID authentication | Yes | `-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----` |
| VAPID_PUBLIC_KEY | Public key distributed to clients | Yes | `BO4...` |
| VAPID_EMAIL | Contact email for VAPID | Yes | `admin@example.com` |

### API endpoints
The webhook server exposes several endpoints for web push functionality:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/push/subscribe` | POST | Register new push subscription |
| `/api/push/unsubscribe` | POST | Remove existing subscription |
| `/api/push/vapid-key` | GET | Retrieve VAPID public key |
| `/api/notify/web-push` | POST | Send notification via web push only |

### Browser compatibility
The service supports major modern browsers with Web Push API support:
- **Chrome**: Version 50+
- **Firefox**: Version 44+
- **Safari**: Version 11.3+
- **Edge**: Version 79+
