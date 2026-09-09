# Content formatting & enhancement

## Introduction
This page explains the content formatting and enhancement services that transform raw, structured data into human-readable notifications for Telegram and other channels. It covers:
- Placement notification formatting for placement offers and updates
- General notice formatting with LLM-based classification, matching, and formatting
- Formatting rules, character limits, Markdown/HTML rendering, and media handling
- Integration with the notification delivery system
- Validation, sanitization, and accessibility considerations

## Project structure
The formatting and enhancement pipeline spans multiple services:
- Data ingestion from SuperSet and email sources
- Structured job and notice models
- LLM-based notice formatter for categorization and formatting
- Placement-specific formatter for placement offers
- Database persistence and retrieval
- Notification dispatch to Telegram and web push channels

```mermaid
graph TB
subgraph "Data Sources"
SS["SuperSet Client"]
EM["Email Client"]
end
subgraph "Processing"
UR["UpdateRunner"]
NFF["NoticeFormatterService"]
PN["PlacementNotificationFormatter"]
DB["DatabaseService"]
end
subgraph "Delivery"
NR["NotificationRunner"]
NS["NotificationService"]
TG["TelegramService"]
end
SS --> UR
EM --> UR
UR --> NFF
UR --> PN
NFF --> DB
PN --> DB
DB --> NR
NR --> NS
NS --> TG
```

## Core components
- PlacementNotificationFormatter: Transforms placement offer events into NoticeDocument instances with human-readable summaries and role breakdowns.
- NoticeFormatterService: LLM-powered notice formatter that classifies content, matches jobs, extracts structured data, and formats Telegram-ready messages.
- DatabaseService: Persists notices, jobs, placement offers, and user data; provides retrieval and status reporting.
- NotificationService and TelegramService: Orchestrate and deliver notifications to Telegram and other channels, with message splitting and Markdown/HTML conversion.
- UpdateRunner and NotificationRunner: Orchestration layers that coordinate data fetching, formatting, persistence, and delivery.

## Architecture overview
The system separates concerns across ingestion, formatting, persistence, and delivery:
- Ingestion: SuperSetClientService and email clients supply notices and jobs.
- Formatting: NoticeFormatterService uses LLM classification and extraction; PlacementNotificationFormatter builds placement summaries.
- Persistence: DatabaseService stores notices, jobs, offers, and user data.
- Delivery: NotificationService coordinates channels; TelegramService renders Markdown/HTML and splits long messages.

```mermaid
sequenceDiagram
participant CLI as "CLI/main.py"
participant UR as "UpdateRunner"
participant SCR as "SuperSetClientService"
participant NFF as "NoticeFormatterService"
participant DB as "DatabaseService"
participant NR as "NotificationRunner"
participant NS as "NotificationService"
participant TG as "TelegramService"
CLI->>UR : "fetch_and_process_updates()"
UR->>SCR : "login_multiple() + get_notices()/get_job_listings_basic()"
SCR-->>UR : "notices, jobs"
UR->>NFF : "format_notice(notice, jobs)"
NFF-->>UR : "formatted notice with formatted_message"
UR->>DB : "save_notice(formatted)"
DB-->>UR : "success"
CLI->>NR : "send_updates()"
NR->>NS : "send_unsent_notices()"
NS->>DB : "get_unsent_notices()"
DB-->>NS : "unsent notices"
loop for each notice
NS->>TG : "broadcast_to_all_users(formatted_message)"
TG-->>NS : "results"
end
NS->>DB : "mark_as_sent(_id)"
```

## Detailed component analysis

### Placement notification formatter
Responsibilities:
- Accept placement events (new offer or update with newly added students)
- Build role-wise breakdowns and totals
- Format human-readable summaries with optional time sent attribution
- Produce NoticeDocument objects for persistence and delivery

Key behaviors:
- Role breakdown aggregation with pluralization and optional package display
- Author attribution from email sender or default
- IST timestamp formatting for createdAt/updatedAt
- Optional time_sent inclusion from event or offer data

Formatting rules:
- New offer: concise summary of total placements and role breakdowns
- Update offer: highlights newly placed students, total count, and role breakdowns with "new" prefix
- Package formatting: converts numeric packages to readable strings (e.g., LPA or formatted Rupees)

```mermaid
flowchart TD
Start(["format_event(event)"]) --> CheckType{"event.type"}
CheckType --> |new_offer| New["format_new_offer_notice()"]
CheckType --> |update_offer| Upd["format_update_offer_notice()"]
CheckType --> |other| Err["raise ValueError"]
New --> BuildRole["build_role_breakdown(students, roles)"]
Upd --> BuildRoleUpd["build_role_breakdown(newly_added, roles, prefix='new')"]
BuildRole --> Summ["compose summary with totals and roles"]
BuildRoleUpd --> SummUpd["compose update summary with totals and roles"]
Summ --> Doc["create NoticeDocument"]
SummUpd --> Doc
Doc --> End(["return NoticeDocument"])
```

### Notice formatter service (LLM-based)
Responsibilities:
- Classify notices into categories (update, shortlisting, announcement, hackathon, webinar, job posting)
- Extract structured information based on category
- Match notices to jobs and optionally enrich matched jobs
- Format Telegram-ready messages with Markdown/HTML

Processing pipeline:
- extract_text: Clean text from HTML content
- classify_post: Single-label classification using LLM
- match_job: Extract company names and fuzzy-match to jobs
- enrich_matched_job: Optional enrichment callback
- extract_info: JSON extraction of structured fields
- format_message: Compose final formatted message with category-specific formatting rules

Formatting rules:
- Announcement: Lightweight passthrough with attribution footer
- Update: LLM-guided concise formatting with Markdown/HTML
- Shortlisting: Lists total shortlisted and student names with role/company
- Webinar/Hackathon: Date/time, venue/platform, registration link, deadlines
- Job posting: Company, role, location, package (with monthly/yearly suffix), eligibility criteria, hiring flow, deadline, and link to details

```mermaid
classDiagram
class NoticeFormatterService {
+format_notice(notice, jobs, job_enricher) Dict
+format_many(notices, jobs) Dict[]
-extract_text(state) PostState
-classify_post(state) PostState
-match_job(state) PostState
-enrich_matched_job(state) PostState
-extract_info(state) PostState
-format_message(state) PostState
-_build_graph() StateGraph
}
class PostState {
+notice : Notice
+jobs : Job[]
+job_enricher
+id : str
+raw_text : str
+category : str
+matched_job : Job
+matched_job_id : str
+job_location : str
+extracted : Dict
+formatted_message : str
}
NoticeFormatterService --> PostState : "manages"
```

### Notification delivery pipeline
Responsibilities:
- Aggregate multiple channels (Telegram, Web Push)
- Retrieve unsent notices from database
- Broadcast messages to users with rate limiting and retries
- Mark notices as sent upon successful delivery

Key behaviors:
- Channel routing and broadcasting
- Fallback to content if formatted_message is missing
- Chunking and retry logic for long messages
- Markdown/HTML conversion and escaping

```mermaid
sequenceDiagram
participant NR as "NotificationRunner"
participant NS as "NotificationService"
participant DB as "DatabaseService"
participant TG as "TelegramService"
NR->>NS : "send_unsent_notices(telegram, web)"
NS->>DB : "get_unsent_notices()"
DB-->>NS : "unsent posts"
loop for each post
NS->>TG : "broadcast_to_all_users(formatted_message or fallback)"
TG-->>NS : "success/failure"
alt any success
NS->>DB : "mark_as_sent(_id)"
end
end
NS-->>NR : "summary stats"
```

### Data models and integration
- Notice and Job models define the structure for notices and job listings.
- Structured job listings are persisted and used for matching.
- Placement offers are merged and emitted as events for notification formatting.

```mermaid
erDiagram
NOTICE {
string id PK
string title
text content
string author
int updatedAt
int createdAt
}
JOB {
string id PK
string job_profile
string company
int placement_category_code
string placement_category
text content
int createdAt
int deadline
string location
float package
string annum_months
text package_info
text job_description
}
PLACEMENT_OFFER {
string company
array roles
array students_selected
int number_of_offers
string time_sent
}
NOTICE ||--o{ JOB : "matched by company"
PLACEMENT_OFFER ||--o{ NOTICE : "emits events for"
```

## Dependency analysis
- NoticeFormatterService depends on:
  - LLM (ChatGoogleGenerativel) for classification and extraction
  - BeautifulSoup for HTML parsing
  - RapidFuzz for fuzzy matching of company names
  - SupersetClient models (Notice, Job, EligibilityMark) for unified typing
- PlacementNotificationFormatter depends on:
  - Pydantic models for typed data structures
  - Core config for safe printing/logging
- NotificationService and TelegramService depend on:
  - DatabaseService for retrieving unsent notices and user lists
  - TelegramClient for actual message sending
- UpdateRunner and NotificationRunner orchestrate dependencies via DI.

```mermaid
graph LR
NFF["NoticeFormatterService"] --> LLM["ChatGoogleGenerativel"]
NFF --> BS4["BeautifulSoup"]
NFF --> RFZ["RapidFuzz"]
NFF --> SUP["SupersetClient Models"]
PN["PlacementNotificationFormatter"] --> PYD["Pydantic Models"]
PN --> CFG["Core Config"]
NS["NotificationService"] --> DB["DatabaseService"]
TG["TelegramService"] --> DB
TG --> TC["TelegramClient"]
UR["UpdateRunner"] --> NFF
UR --> PN
UR --> DB
NR["NotificationRunner"] --> NS
NR --> TG
NR --> DB
```

## Performance considerations
- LLM calls: Classification, extraction, and formatting involve external LLM calls. Use batching and caching where appropriate.
- Message length: Telegram messages are chunked at 4000 characters; ensure formatted content respects this limit to avoid truncation.
- Rate limiting: TelegramService applies small delays between broadcasts to avoid rate limits.
- Database operations: Efficient ID lookups and bulk operations reduce latency for notice/job synchronization.
- Fuzzy matching: Company name matching uses token-set ratio scoring; tune thresholds to balance precision/recall.

[No sources needed since this section provides general guidance]

## Troubleshooting guide
Common issues and resolutions:
- LLM formatting failures: Extraction JSON parsing errors are handled gracefully; review extracted blocks and refine prompts.
- Telegram delivery failures: TelegramService retries without formatting when parse_mode fails; verify bot token and chat ID configuration.
- Long messages: Automatic chunking occurs; verify chunk sizes and ensure message continuity.
- Notice persistence: DatabaseService returns explicit errors for missing IDs or initialization issues; confirm collection availability.
- Job enrichment: Enrichment callback requires matched job presence; otherwise, fallback to extracted data.

## Conclusion
The formatting and enhancement services provide a reliable pipeline for transforming diverse content into consistent, readable notifications. PlacementNotificationFormatter focuses on placement-specific summaries, while NoticeFormatterService uses LLM classification and extraction for general notices. The system integrates cleanly with database persistence and multi-channel delivery, with careful attention to message length, formatting, and reliability.

[No sources needed since this section summarizes without analyzing specific files]

## Appendices

### Formatting rules and examples

- Placement new offer summary:
  - Example structure: Total placements, role breakdowns, optional time_sent attribution, and a celebratory note.
  - Use case: Announce placement results for a company.

- Placement update summary:
  - Example structure: Highlight newly placed students, total count, role breakdowns with "new" prefix, and celebratory note.

- Announcement passthrough:
  - Example structure: Title bolded, body lightly prettified, attribution footer with author and posted date.

- Update via LLM:
  - Example structure: Category-specific concise formatting with Markdown/HTML, emojis, and footers.

- Shortlisting:
  - Example structure: Total shortlisted, student list, role/company, optional package info and hiring flow.

- Webinar:
  - Example structure: Event title, topic, speaker, date/time, venue/platform, registration link, deadline.

- Hackathon:
  - Example structure: Event title, theme, duration, team size, prize pool, venue/platform, registration link, deadline.

- Job posting:
  - Example structure: Company, role, location, package (with monthly/yearly suffix), eligibility criteria, hiring flow, deadline, and link to details.

### Character limits and media handling
- Telegram message length: Messages exceeding 4000 characters are automatically split into chunks.
- Media attachments: The current implementation focuses on text formatting; images or documents are not embedded by default. Links and HTML anchors are supported for external resources.

### Integration with notification delivery
- Channels: Telegram and Web Push channels are supported; channel selection is configurable.
- Fallbacks: If formatted_message is missing, a fallback composed from title and content is used.
- Persistence: Notices are marked as sent after successful delivery to at least one channel.

### Configuration and environment
- Settings include Telegram bot token, chat ID, SuperSet credentials, Google API key, and logging configuration.
- Safe printing and daemon mode support are integrated for production runs.
