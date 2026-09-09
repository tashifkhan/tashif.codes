# Subscriptions management API

## Introduction
This page provides detailed API documentation for subscription management endpoints within the notice-reminders system. It covers CRUD operations for course subscriptions, subscription preferences, and notification settings. It explains subscription validation, duplicate prevention, status management, lifecycle handling, automatic renewal behavior, cancellation procedures, analytics, usage tracking, and preference-based filtering. The documentation includes endpoint definitions, request/response schemas, error handling, and practical workflows for creating, modifying, and deleting subscriptions.

## Project structure
The subscription management feature is implemented in the notice-reminders backend (FastAPI application). Key components include:
- API router exposing subscription endpoints
- Service layer implementing subscription logic
- Pydantic schemas for request/response validation
- Tortoise ORM models for persistence
- Dependencies for service injection
- Related notification channel models and services

```mermaid
graph TB
subgraph "API Layer"
R["subscriptions.py<br/>Router: /subscriptions"]
end
subgraph "Service Layer"
S["subscription_service.py<br/>SubscriptionService"]
NS["notification_channel_service.py<br/>NotificationChannelService"]
end
subgraph "Persistence Layer"
M1["subscription.py<br/>Subscription model"]
M2["course.py<br/>Course model"]
M3["user.py<br/>User model"]
M4["notification_channel.py<br/>NotificationChannel model"]
end
subgraph "Validation"
V1["subscription.py<br/>SubscriptionCreate/Response"]
V2["notification_channel.py<br/>NotificationChannelCreate/Response"]
end
R --> S
R --> NS
S --> M1
S --> M2
S --> M3
NS --> M4
R --> V1
NS --> V2
```

## Core components
- Subscription API Router: Exposes endpoints for creating, listing, and deleting subscriptions under /subscriptions.
- Subscription Service: Implements subscription logic including duplicate prevention and retrieval.
- Subscription Model: Defines the subscription entity with foreign keys to User and Course, timestamps, and activation flag.
- Course Model: Provides course metadata and uniqueness constraints.
- User Model: Identifies users and supports authentication-dependent operations.
- Notification Channel Models and Services: Manage user notification preferences and channels.

Key capabilities:
- Create subscription via course code with duplicate prevention
- List subscriptions per user
- Delete subscription with ownership verification
- Manage notification channels and preferences
- Announcements caching and retrieval for course subscriptions

## Architecture overview
The subscription management architecture follows a layered pattern:
- API Router handles HTTP requests and injects services via FastAPI Depends
- Service layer encapsulates business logic and interacts with models
- Persistence layer uses Tortoise ORM with unique constraints to prevent duplicates
- Authentication middleware ensures only authenticated users can access subscription endpoints

```mermaid
sequenceDiagram
participant Client as "Client"
participant Router as "subscriptions.py"
participant Auth as "require_auth"
participant Deps as "Dependencies"
participant Service as "SubscriptionService"
participant CourseSvc as "CourseService"
participant DB as "Tortoise ORM"
Client->>Router : POST /subscriptions
Router->>Auth : Verify session/token
Auth-->>Router : Current user
Router->>Deps : get_course_service()
Deps-->>Router : CourseService instance
Router->>Deps : get_subscription_service()
Deps-->>Router : SubscriptionService instance
Router->>CourseSvc : get_by_code(course_code)
CourseSvc->>DB : Query course by code
DB-->>CourseSvc : Course or None
alt Course exists
Router->>Service : subscribe(user, course)
Service->>DB : Create subscription
DB-->>Service : Subscription
Service-->>Router : Subscription
Router-->>Client : 201 Created + SubscriptionResponse
else Course not found
Router-->>Client : 404 Not Found
end
```

## Detailed component analysis

### Subscription endpoints
- Base path: /subscriptions
- Authentication: All endpoints require authentication via require_auth decorator

Endpoints:
- POST /subscriptions
  - Purpose: Create a subscription for a course by code
  - Request body: SubscriptionCreate (course_code)
  - Response: SubscriptionResponse (id, user_id, course_id, is_active, created_at)
  - Status codes: 201 Created, 404 Not Found (course missing)
  - Validation: Course existence checked before subscription creation

- GET /subscriptions
  - Purpose: List all subscriptions for the authenticated user
  - Response: Array of SubscriptionResponse
  - Status codes: 200 OK

- DELETE /subscriptions/{subscription_id}
  - Purpose: Cancel a subscription
  - Path parameter: subscription_id (int)
  - Response: No content (204)
  - Status codes: 404 Not Found (subscription missing), 403 Forbidden (access denied)

Authorization and ownership checks:
- DELETE endpoint verifies that the subscription belongs to the current user before deletion

### Subscription service
Responsibilities:
- subscribe(user, course): Creates a subscription; if a duplicate exists (unique constraint), returns the existing subscription
- list_for_user(user): Retrieves all subscriptions for a user ordered by creation time
- list_all(): Retrieves all subscriptions ordered by creation time
- delete(subscription): Removes a subscription

Duplicate prevention:
- Uses database unique constraint on (user, course) enforced by Tortoise model definition
- On IntegrityError during creation, retrieves the existing subscription

Status management:
- Subscription records include is_active flag; service does not toggle it on create/delete

### Data models and schemas
Models:
- Subscription: Links User and Course, tracks creation time, and activation status
- Course: Course metadata with unique code
- User: User identity with optional Telegram ID and activity flag
- NotificationChannel: User notification preferences with channel/address and activation

Schemas:
- SubscriptionCreate: course_code
- SubscriptionResponse: id, user_id, course_id, is_active, created_at
- NotificationChannelCreate: channel, address, is_active
- NotificationChannelResponse: id, user_id, channel, address, is_active, created_at

Unique constraints:
- Subscription: unique_together (user, course)
- Course: unique code
- NotificationChannel: unique_together (user, channel, address)

### Notification preferences and channels
Endpoints:
- GET /notification-channels (conceptual, see service usage below)
- POST /notification-channels (conceptual)
- PATCH /notification-channels/{id}/disable (conceptual)

Services:
- NotificationChannelService: list_for_user, create, disable
- Behavior: Prevents duplicate channels per user-channel-address combination via unique constraint

Integration:
- Notification preferences complement subscriptions by controlling how and where users receive updates

### Announcements and subscription analytics
Announcements:
- AnnouncementService fetches and caches announcements per course
- Deduplicates announcements by title and date; updates content if changed
- Supports listing announcements for a course

Analytics and usage tracking:
- Announcement caching provides historical context for subscription analytics
- Subscription listing enables usage tracking per user and course

## Dependency analysis
Service injection and routing:
- API router depends on CourseService and SubscriptionService via get_* dependency functions
- Dependencies module provides cached instances of services
- Application wiring includes subscription router in main app factory

```mermaid
graph LR
Main["main.py<br/>create_app()"] --> Router["subscriptions.py<br/>APIRouter('/subscriptions')"]
Router --> Deps["dependencies.py<br/>get_*()"]
Deps --> CourseSvc["CourseService"]
Deps --> SubSvc["SubscriptionService"]
SubSvc --> SubModel["Subscription model"]
SubSvc --> CourseModel["Course model"]
SubSvc --> UserModel["User model"]
```

## Performance considerations
- Unique constraints on (user, course) and (user, channel, address) prevent redundant writes and improve lookup performance
- Ordering by created_at in list queries ensures recent subscriptions appear first
- Announcement caching reduces repeated external API calls and database writes
- Consider adding pagination for listing endpoints if subscription volumes grow large

## Troubleshooting guide
Common errors and resolutions:
- 404 Not Found when creating subscription:
  - Cause: Course code does not exist
  - Resolution: Verify course code or fetch course list first

- 404 Not Found when deleting subscription:
  - Cause: Subscription ID does not exist
  - Resolution: Refresh subscription list and confirm ID

- 403 Forbidden when deleting subscription:
  - Cause: Subscription does not belong to the current user
  - Resolution: Ensure user context matches subscription owner

- Duplicate subscription creation:
  - Behavior: Service returns existing subscription instead of raising error
  - Resolution: No action needed; idempotent behavior prevents duplication

## Conclusion
The subscription management API provides a reliable foundation for course subscriptions with built-in duplicate prevention, user ownership enforcement, and integration with course and notification systems. While explicit subscription status toggling and automatic renewal are not implemented in the current code, the underlying models and services support extending the feature set. The architecture cleanly separates concerns across API, service, and persistence layers, enabling future enhancements such as subscription analytics, preference-based filtering, and lifecycle automation.
