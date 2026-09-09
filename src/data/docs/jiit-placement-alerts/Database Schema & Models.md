# Database schema & models

## Introduction
This page provides detailed database schema documentation for the SuperSet Telegram Notification Bot's MongoDB implementation. It covers the five main collections (Notices, Jobs, PlacementOffers, Users, OfficialData), their field definitions, data types, validation rules, entity relationships, indexes, and query patterns. It also explains data modeling decisions, normalization strategies, performance considerations, sample documents, common queries, data lifecycle management, retention policies, backup strategies, and integrity constraints.

## Project structure
The database layer is implemented as a service that wraps a MongoDB client. The service exposes CRUD and aggregation operations for each collection, while the client manages the connection and collection references. Runners orchestrate data ingestion and notification dispatch, relying on the database service for persistence and retrieval.

```mermaid
graph TB
subgraph "Application Layer"
UR["UpdateRunner"]
NR["NotificationRunner"]
DS["DatabaseService"]
DC["DBClient"]
end
subgraph "MongoDB"
DB["SupersetPlacement DB"]
C1["Notices"]
C2["Jobs"]
C3["PlacementOffers"]
C4["Users"]
C5["OfficialPlacementData"]
end
UR --> DS
NR --> DS
DS --> DC
DC --> DB
DB --> C1
DB --> C2
DB --> C3
DB --> C4
DB --> C5
```

## Core components
- DatabaseService: Centralized service exposing operations for Notices, Jobs, PlacementOffers, Users, Policies, and OfficialPlacementData. It encapsulates MongoDB collection access and implements CRUD, upserts, aggregations, and statistics.
- DBClient: Thin wrapper around PyMongo to manage connection, database selection, and collection initialization.
- Runners: UpdateRunner orchestrates fetching notices/jobs from SuperSet, enriching and saving to DB; NotificationRunner retrieves unsent notices and broadcasts via Telegram/WebPush.

Key responsibilities:
- Notices: Store formatted notices with sent status per channel.
- Jobs: Structured job listings with enrichment and deduplication.
- PlacementOffers: Offers extracted from emails with merge logic and event emission.
- Users: Subscription and preference management.
- OfficialPlacementData: Aggregated placement statistics snapshots.

## Architecture overview
The system follows a layered architecture:
- Clients: DBClient connects to MongoDB and exposes collections.
- Services: DatabaseService abstracts operations and enforces data shaping.
- Runners: Orchestrate ingestion and notifications using injected services.

```mermaid
sequenceDiagram
participant UR as "UpdateRunner"
participant SCR as "SupersetClientService"
participant FRM as "NoticeFormatterService"
participant DB as "DatabaseService"
participant COL as "MongoDB Collections"
UR->>SCR : Login + Fetch notices/jobs
UR->>FRM : Format notices (with job enricher callback)
FRM-->>UR : Formatted notice payload
UR->>DB : save_notice / upsert_structured_job
DB->>COL : Insert/Update documents
COL-->>DB : Acknowledged write
DB-->>UR : Success/Failure
```

## Detailed component analysis

### Notices collection
Purpose: Store all types of notifications (job postings, announcements, updates) with channel-specific sent flags and metadata.

Fields and types:
- _id: ObjectId
- id: String (unique)
- title: String
- content: String
- source: String ('superset' | 'email' | 'official')
- category: String (e.g., 'announcement', 'job_posting', 'shortlisting', 'internship_noc', 'hackathon', 'webinar', 'update')
- formatted_content: String
- sent_to_telegram: { value: Boolean, timestamp: Date }
- sent_to_webpush: { value: Boolean, timestamp: Date }
- metadata: { company: String, role: String, deadline: Date, tags: [String] }
- created_at: Date
- updated_at: Date
- scraped_at: Date

Validation rules:
- Unique index on id.
- Compound indexes for efficient filtering by sent status and creation time.
- Category/source filters enable targeted retrieval.

Indexes:
- Unique: { id: 1 }
- Non-unique: { sent_to_telegram: 1 }, { sent_to_webpush: 1 }, { created_at: -1 }, { source: 1, category: 1 }

Sample documents:
- See example in `DATABASE.md`.

Common queries:
- Find unsent notices: see `DATABASE.md`.
- Bulk update sent timestamps: see `DATABASE.md`.

Operational usage:
- Existence checks and ID retrieval for deduplication during ingestion.
- Chronological retrieval for notification dispatch.

### Jobs collection
Purpose: Structured job profiles extracted from SuperSet, with eligibility criteria, positions, compensation, and deadlines.

Fields and types:
- _id: ObjectId
- job_id: String (unique)
- company: String
- job_title: String
- job_description: String
- qualification_criteria: { min_cgpa: Number, branches: [String], batch_years: [String] }
- position_details: { total_positions: Number, job_location: String, job_type: String }
- compensation: { base_salary: Number, bonus: Number, currency: String }
- application_deadline: Date
- posted_at: Date
- source_url: String
- created_at: Date
- updated_at: Date

Indexes:
- Unique: { job_id: 1 }
- Non-unique: { company: 1 }, { application_deadline: 1 }

Sample documents:
- See example in `DATABASE.md`.

Operational usage:
- Upsert job records with merge of updated_at.
- Retrieval sorted by creation time for recent listings.

### PlacementOffers collection
Purpose: Offers extracted from emails, with roles, selected students, and processing status.

Fields and types:
- _id: ObjectId
- offer_id: String (unique)
- company: String
- role: String
- package: { base: Number, bonus: Number, total: Number, currency: String }
- students_selected: [{ name: String, email: String, branch: String, enrollment_number: String }]
- offer_status: String ('pending', 'confirmed', 'completed')
- source_email: String
- processing_status: String ('new', 'processed', 'notified')
- notifications_sent: { telegram: Boolean, webpush: Boolean }
- extracted_at: Date
- created_at: Date
- updated_at: Date

Indexes:
- Unique: { offer_id: 1 }
- Non-unique: { company: 1 }, { processing_status: 1 }, { created_at: -1 }

Sample documents:
- See example in `DATABASE.md`.

Operational usage:
- Merge logic for updating offers and students, emitting events for new/updated offers.
- Stats computation across offers and students.

### Users collection
Purpose: User subscription and preferences, including web push subscriptions.

Fields and types:
- _id: ObjectId
- user_id: String (unique)
- first_name: String
- username: String
- subscription_active: Boolean
- notification_preferences: { telegram: Boolean, webpush: Boolean, email: Boolean }
- webpush_subscriptions: [{ subscription_id: String, endpoint: String, keys: { p256dh: String, auth: String }, created_at: Date }]
- registered_at: Date
- last_active: Date
- notifications_sent: Number
- metadata: { branch: String, batch_year: String, device_type: String }

Indexes:
- Unique: { user_id: 1 }
- Non-unique: { subscription_active: 1 }, { last_active: -1 }, { registered_at: 1 }

Sample documents:
- See example in `DATABASE.md`.

Operational usage:
- Add or reactivate users, soft-deactivate on unsubscribe.
- Retrieve active users for broadcasting.

### OfficialPlacementData collection
Purpose: Aggregated placement statistics snapshots from official sources.

Fields and types:
- _id: ObjectId
- data_id: String (unique)
- timestamp: Date
- overall_statistics: { total_students: Number, total_placed: Number, placement_percentage: Number, average_package: Number, highest_package: Number, lowest_package: Number }
- branch_wise: Map of branch to { total: Number, placed: Number, percentage: Number, average_package: Number }
- company_wise: [{ company: String, students_placed: Number, average_package: Number, roles: [String] }]
- sector_wise: Map of sector to count
- source_url: String
- created_at: Date
- updated_at: Date

Indexes:
- Unique: { data_id: 1 }
- Non-unique: { timestamp: -1 }

Sample documents:
- See example in `DATABASE.md`.

Operational usage:
- Deduplicate by content hash and update scrape timestamps.
- Retrieve latest snapshot for stats.

### Entity relationships and normalization
- One-way relationships:
  - Notices may link to Jobs via enrichment during formatting; no foreign key is stored.
  - PlacementOffers are independent snapshots; no explicit links to Users.
- Denormalization:
  - Notices embed sent flags per channel to avoid joins and simplify dispatch.
  - Jobs embed structured fields for fast filtering and display.
- Event-driven updates:
  - PlacementOffers emits events for new offers and updates to trigger notifications.

### Indexing strategy
- Notices: Unique id; sent flags; creation time; source/category.
- Jobs: Unique job_id; company; deadline.
- PlacementOffers: Unique offer_id; company; processing_status; creation time.
- Users: Unique user_id; subscription and activity.
- OfficialPlacementData: Unique data_id; timestamp.

Index creation and usage examples are documented in `DATABASE.md`.

### Query patterns and examples
- Find unsent notices: see `DATABASE.md`.
- Get recent placements: see `DATABASE.md`.
- Count active users: see `DATABASE.md`.
- Get branch-wise stats: see `DATABASE.md`.
- Find company offers: see `DATABASE.md`.
- Bulk update sent timestamps: see `DATABASE.md`.

### Data modeling decisions
- Embedded arrays for students and roles allow atomic updates and reduce joins.
- Separate sent flags per channel enable idempotent dispatch and auditability.
- Structured job fields enable fast filtering and display without joins.
- Official data snapshots capture time-series aggregates for reporting.

### Sample documents
- Notices: `DATABASE.md`
- Jobs: `DATABASE.md`
- PlacementOffers: `DATABASE.md`
- Users: `DATABASE.md`
- OfficialPlacementData: `DATABASE.md`

### Common query examples
- Unsent notices: `DATABASE.md`
- Recent offers: `DATABASE.md`
- Active users count: `DATABASE.md`
- Branch stats: `DATABASE.md`
- Company offers aggregation: `DATABASE.md`
- Bulk sent timestamp update: `DATABASE.md`

### Data lifecycle management
- Ingestion: UpdateRunner fetches notices/jobs, filters duplicates, enriches jobs, formats notices, and persists to DB.
- Dispatch: NotificationRunner retrieves unsent notices and sends via Telegram/WebPush, marking sent flags.
- Stats: Placement stats computed from PlacementOffers; official stats deduplicated by content hash.

### Retention policies and backup strategies
- TTL indexes: Recommended for auto-cleanup of logs and temporary data (see `DATABASE.md`).
- Snapshots: OfficialPlacementData captures periodic snapshots; deduplication via content hash (see `database_service.py`).
- Backups: Use MongoDB native tools or cloud provider backups; schedule regular snapshots of all collections.

### Integrity constraints and validation
- Unique indexes enforce uniqueness for identifiers (id, job_id, offer_id, user_id, data_id).
- Existence checks prevent duplicate writes.
- Sent flags and processing statuses act as audit trails for idempotent operations.

## Dependency analysis
The database layer depends on:
- DBClient for connection and collection access.
- DatabaseService for operations and data shaping.
- Runners for orchestration and invoking service methods.

```mermaid
classDiagram
class DBClient {
+connect()
+close_connection()
+notices_collection
+jobs_collection
+placement_offers_collection
+users_collection
+official_placement_data_collection
}
class DatabaseService {
+notice_exists(id)
+save_notice(notice)
+get_all_notice_ids()
+upsert_structured_job(job)
+save_placement_offers(offers)
+get_placement_stats()
+add_user(...)
+get_active_users()
+save_official_placement_data(data)
}
class UpdateRunner {
+fetch_and_process_updates()
}
class NotificationRunner {
+send_updates(telegram, web)
}
UpdateRunner --> DatabaseService : "uses"
NotificationRunner --> DatabaseService : "uses"
DatabaseService --> DBClient : "wraps"
```

## Performance considerations
- Efficient queries: Filter early and limit results (see `DATABASE.md`).
- Projections: Select only needed fields to reduce payload size (see `DATABASE.md`).
- Batch operations: Insert/update in batches for throughput (see `DATABASE.md`).
- TTL indexes: Automatic cleanup for temporary data (see `DATABASE.md`).
- Connection pooling: Use PyMongo defaults; tune pool size as needed (see `DATABASE.md`).

## Troubleshooting guide
- Connection failures: Verify MONGO_CONNECTION_STR and DBClient connection logic.
- Missing collections: Ensure DBClient initializes all required collections.
- Duplicate inserts: Use notice_exists/get_all_notice_ids and upsert patterns.
- Slow queries: Confirm appropriate indexes exist and queries use indexed fields.
- Broadcast failures: Check Telegram bot token/chat ID and rate limits.

## Conclusion
The MongoDB schema for the SuperSet Telegram Notification Bot emphasizes denormalization, embedded arrays, and channel-specific sent flags to enable efficient ingestion, formatting, and dispatch. The five collections are designed for high-cardinality, time-series, and preference-driven workflows. Proper indexing, batch operations, and TTL-based cleanup ensure scalability and maintainability.

## Appendices

### Appendix A: index creation commands
See `DATABASE.md`.

### Appendix B: data samples
- Notices: `DATABASE.md`
- Jobs: `DATABASE.md`
- PlacementOffers: `DATABASE.md`
- Users: `DATABASE.md`
- OfficialPlacementData: `DATABASE.md`

### Appendix C: operational scripts and data sources
- Notices ingestion sample: `notices.json`
- Jobs ingestion sample: `structured_job_listings.json`
- Placement offers sample: `placement_offers.json`
