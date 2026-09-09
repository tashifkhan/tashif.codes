# Database models

## Introduction
This page describes the complete database model layer for the Notice Reminders system built with Tortoise ORM. It covers each persistent model, including fields, data types, constraints, indexes, and relationships. It also documents validation rules enforced at the Pydantic schema level, and provides examples of model instantiation and common query patterns.

## Project structure
The database models are defined under the notice-reminders application as Tortoise ORM models. The FastAPI integration registers these models with Tortoise and can optionally generate database schemas.

```mermaid
graph TB
subgraph "Models"
U["User"]
C["Course"]
A["Announcement"]
S["Subscription"]
N["Notification"]
NC["NotificationChannel"]
OTP["OtpCode"]
RT["RefreshToken"]
end
subgraph "Registration"
DB["Tortoise Config<br/>register_tortoise()"]
end
DB --> U
DB --> C
DB --> A
DB --> S
DB --> N
DB --> NC
DB --> OTP
DB --> RT
```

## Core components
This section documents each model's structure, fields, constraints, and indexes.

- User
  - Fields: id (primary key), email (unique, indexed), name, telegram_id (unique, nullable), is_active, created_at, updated_at
  - Indexing: email, telegram_id
  - Constraints: unique(email), unique(telegram_id)
  - Notes: Uses auto timestamps for created_at and updated_at

- Course
  - Fields: id (primary key), code (unique, indexed), title, url, instructor, institute, nc_code, created_at, updated_at
  - Indexing: code
  - Constraints: unique(code)
  - Notes: Uses auto timestamps

- Announcement
  - Fields: id (primary key), course (foreign key to Course), title, date, content (text), fetched_at
  - Relationships: belongs to Course via ForeignKeyField
  - Indexing: none declared
  - Notes: Uses auto timestamps

- Subscription
  - Fields: id (primary key), user (foreign key to User), course (foreign key to Course), created_at, is_active
  - Relationships: belongs to User and Course via ForeignKeyField
  - Constraints: unique_together(user, course)
  - Notes: Uses auto timestamps

- Notification
  - Fields: id (primary key), user (foreign key to User), subscription (foreign key to Subscription), announcement (foreign key to Announcement), channel (nullable foreign key to NotificationChannel), sent_at, is_read
  - Relationships: belongs to User, Subscription, Announcement, and optionally NotificationChannel
  - Notes: Uses auto timestamps

- NotificationChannel
  - Fields: id (primary key), user (foreign key to User), channel, address, is_active, created_at
  - Relationships: belongs to User via ForeignKeyField
  - Constraints: unique_together(user, channel, address)
  - Notes: Uses auto timestamps

- OtpCode
  - Fields: id (primary key), email (indexed), code, expires_at, is_used, created_at
  - Indexing: email
  - Notes: Uses auto timestamps

- RefreshToken
  - Fields: id (primary key), user (foreign key to User, CASCADE delete), token (unique, indexed), expires_at, is_revoked, created_at
  - Relationships: belongs to User via ForeignKeyField with CASCADE deletion
  - Constraints: unique(token)
  - Notes: Uses auto timestamps

Validation rules enforced at the schema level:
- UserUpdate and UserResponse define allowable updates and response shapes for User, including optional fields and required types.
- CourseResponse defines the shape for Course responses.
- AnnouncementResponse defines the shape for Announcement responses.

## Architecture overview
The models form a normalized relational schema centered around Users, Courses, and Announcements. Subscriptions link Users to Courses. Notifications track delivery of Announcements to Users via NotificationChannels. OTP and RefreshToken support authentication flows.

```mermaid
erDiagram
USERS {
int id PK
varchar email UK
varchar name
varchar telegram_id UK
boolean is_active
datetime created_at
datetime updated_at
}
COURSES {
int id PK
varchar code UK
varchar title
varchar url
varchar instructor
varchar institute
varchar nc_code
datetime created_at
datetime updated_at
}
SUBSCRIPTIONS {
int id PK
int user_id FK
int course_id FK
boolean is_active
datetime created_at
}
ANNOUNCEMENTS {
int id PK
int course_id FK
varchar title
varchar date
text content
datetime fetched_at
}
NOTIFICATIONS {
int id PK
int user_id FK
int subscription_id FK
int announcement_id FK
int channel_id FK
datetime sent_at
boolean is_read
}
NOTIFICATION_CHANNELS {
int id PK
int user_id FK
varchar channel
varchar address
boolean is_active
datetime created_at
}
OTP_CODES {
int id PK
varchar email
varchar code
datetime expires_at
boolean is_used
datetime created_at
}
REFRESH_TOKENS {
int id PK
int user_id FK
varchar token UK
datetime expires_at
boolean is_revoked
datetime created_at
}
USERS ||--o{ SUBSCRIPTIONS : "has"
COURSES ||--o{ SUBSCRIPTIONS : "has"
USERS ||--o{ NOTIFICATIONS : "receives"
SUBSCRIPTIONS ||--o{ NOTIFICATIONS : "generates"
ANNOUNCEMENTS ||--o{ NOTIFICATIONS : "notified"
USERS ||--o{ NOTIFICATION_CHANNELS : "owns"
USERS ||--o{ REFRESH_TOKENS : "has"
```

## Detailed component analysis

### User model
- Purpose: Stores user account information and profile attributes.
- Authentication-related fields: email (unique), telegram_id (unique), plus refresh tokens managed separately.
- Validation: Pydantic schema allows partial updates and enforces email format and optional fields.
- Typical queries:
  - Retrieve by email: filter by unique email index.
  - Retrieve by telegram_id: filter by unique telegram_id index.
  - List active users: filter by is_active.

### Course model
- Purpose: Represents MOOC course metadata.
- Platform and metadata fields: code (unique), title, url, instructor, institute, nc_code.
- Typical queries:
  - Find course by code: uses unique index on code.
  - Bulk fetch with pagination.

### Announcement model
- Purpose: Stores parsed course announcements with content and fetch metadata.
- Content parsing fields: title, date, content (text), fetched_at.
- Relationship: ForeignKey to Course.
- Typical queries:
  - Get latest announcements per course: order by fetched_at desc.
  - Filter by date range using fetched_at.

### Subscription model
- Purpose: Links users to courses for notification delivery.
- Relationships: ForeignKey to User and Course.
- Constraint: unique_together(user, course) ensures a user cannot subscribe to the same course twice.
- Typical queries:
  - List a user's active subscriptions.
  - Remove duplicates by checking unique constraint before insert.

### Notification model
- Purpose: Tracks notification deliveries to users and marks read state.
- Relationships: ForeignKey to User, Subscription, Announcement, and optional NotificationChannel.
- Delivery tracking: sent_at and is_read flags.
- Typical queries:
  - Mark as read: update is_read.
  - Inbox view: filter by user and order by sent_at desc.

### NotificationChannel model
- Purpose: Defines user-specific delivery channels (e.g., email, Telegram) with addresses.
- Relationships: ForeignKey to User.
- Constraint: unique_together(user, channel, address) prevents duplicate channel/address pairs per user.
- Typical queries:
  - List a user's channels.
  - Find channel by type and address.

### OTP model
- Purpose: Supports one-time code verification flows.
- Fields: email (indexed), code, expires_at, is_used, created_at.
- Typical queries:
  - Lookup unexpired, unused OTP by email.
  - Invalidate after use by setting is_used.

### RefreshToken model
- Purpose: Manages long-lived refresh tokens for secure sessions.
- Relationships: ForeignKey to User with CASCADE delete.
- Constraints: unique(token), index(token), expires_at, is_revoked.
- Typical queries:
  - Validate token existence and non-revocation.
  - Revoke by setting is_revoked.

## Dependency analysis
The models are organized with explicit foreign keys and related names. The registration module wires Tortoise to load all models.

```mermaid
graph LR
DB["Tortoise Config"] --> M1["User"]
DB --> M2["Course"]
DB --> M3["Announcement"]
DB --> M4["Subscription"]
DB --> M5["Notification"]
DB --> M6["NotificationChannel"]
DB --> M7["OtpCode"]
DB --> M8["RefreshToken"]
M3 --> M2
M4 --> M1
M4 --> M2
M5 --> M1
M5 --> M4
M5 --> M3
M5 --> M6
M7 --> M1
M8 --> M1
```

## Performance considerations
- Indexes: email and telegram_id on User; code on Course; email on OtpCode; token on RefreshToken. These indexes optimize lookups for authentication and user-centric operations.
- Unique constraints: email and telegram_id on User; code on Course; unique(token) and unique_together(user, course) on Subscription; unique_together(user, channel, address) on NotificationChannel. These prevent duplicates and enforce business rules efficiently at the RDBMS level.
- Auto timestamps: created_at and updated_at reduce application-level timestamp management overhead.
- Text fields: content in Announcement uses TextField to accommodate large content sizes.

[No sources needed since this section provides general guidance]

## Troubleshooting guide
- Integrity errors on inserts:
  - Unique violations on email or telegram_id in User.
  - Unique violations on code in Course.
  - Unique violations on token in RefreshToken.
  - Duplicate Subscription entries due to unique_together(user, course).
  - Duplicate NotificationChannel entries due to unique_together(user, channel, address).
- Cascade behavior:
  - Deleting a User deletes associated RefreshTokens due to CASCADE on RefreshToken.user.
- Query pitfalls:
  - Ensure proper ordering by timestamps (e.g., fetched_at, sent_at) for recent items.
  - Use related filters via Tortoise relations (e.g., user.subscriptions, course.announcements) to avoid N+1 queries.

## Conclusion
The Notice Reminders database models provide a clean, normalized schema optimized for user management, course discovery, announcement ingestion, and notification delivery. Constraints and indexes ensure data integrity and efficient lookups. Together with Pydantic schemas, the system enforces validation at both persistence and API boundaries.
