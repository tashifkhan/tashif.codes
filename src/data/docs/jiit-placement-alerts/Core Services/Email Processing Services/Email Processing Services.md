# Email processing services

## Introduction
This page explains the email processing services that power intelligent notice classification, content extraction, and standardized formatting for placement and general notices. It covers:
- EmailNoticeService for general notice classification and extraction
- PlacementService for LLM-powered placement offer extraction
- Formatter services for content transformation and notification-ready output
- Integration with Google Gemini LLMs, including prompt engineering and structured data extraction
- The end-to-end pipeline from raw email ingestion to structured data storage and notification delivery

## Project structure
The email processing system is organized around modular services and clients:
- Services: EmailNoticeService, PlacementService, NoticeFormatterService, PlacementNotificationFormatter, PlacementPolicyService
- Clients: GoogleGroupsClient for email ingestion
- Database: DatabaseService for persistence
- Orchestration: main.py coordinates email processing and integrates with the broader notification system

```mermaid
graph TB
subgraph "Orchestrator"
MAIN["main.py<br/>cmd_update_emails()"]
end
subgraph "Email Ingestion"
GGC["GoogleGroupsClient"]
end
subgraph "Extraction Services"
ENS["EmailNoticeService"]
PS["PlacementService"]
PPS["PlacementPolicyService"]
end
subgraph "Formatting Services"
NFS["NoticeFormatterService"]
PNF["PlacementNotificationFormatter"]
end
subgraph "Persistence"
DB["DatabaseService"]
end
MAIN --> GGC
MAIN --> PS
MAIN --> ENS
PS --> PNF
ENS --> NFS
ENS --> PPS
PS --> DB
ENS --> DB
NFS --> DB
PNF --> DB
```

## Core components
- EmailNoticeService: LLM-driven classification and extraction of general notices (announcements, job postings, webinars, hackathons, shortlistings, reminders, internship NOCs). Integrates with NoticeFormatterService for standardized formatting and PlacementPolicyService for policy updates.
- PlacementService: Keyword-based classification plus LLM extraction for final placement offers, with privacy sanitization and structured validation.
- NoticeFormatterService: LLM-based notice formatting pipeline (text extraction, classification, fuzzy matching, structured extraction, and message formatting) for general notices.
- PlacementNotificationFormatter: Creates notification-ready documents for placement events (new offers and updates).
- PlacementPolicyService: Manages placement policy documents (Markdown, TOC generation, year extraction, CRUD).
- GoogleGroupsClient: IMAP-based email retrieval and forwarded metadata extraction.
- DatabaseService: MongoDB operations for notices, jobs, placement offers, policies, and user management.

## Architecture overview
The system orchestrates email processing through a unified command that:
1. Fetches unread email IDs
2. Attempts PlacementService classification/extraction
3. Falls back to EmailNoticeService for general notices
4. Persists results to MongoDB
5. Generates placement notifications via PlacementNotificationFormatter

```mermaid
sequenceDiagram
participant CLI as "CLI (main.py)"
participant GGC as "GoogleGroupsClient"
participant PS as "PlacementService"
participant ENS as "EmailNoticeService"
participant DB as "DatabaseService"
participant PNF as "PlacementNotificationFormatter"
CLI->>GGC : get_unread_message_ids()
loop For each email
CLI->>GGC : fetch_email(email_id)
CLI->>PS : process_email(email_data)
alt Placement offer detected
PS->>DB : save_placement_offers([offer])
DB-->>PS : events[]
PS->>PNF : process_events(events)
PNF->>DB : save_notice(placement_update)
else Not a placement offer
CLI->>ENS : process_single_email(email_data)
ENS->>DB : save_notice(notice_doc)
end
CLI->>GGC : mark_as_read(email_id)
end
```

## Detailed component analysis

### EmailNoticeService
- Purpose: Classify and extract general notices from Google Groups emails using LLM prompts and LangGraph.
- Key features:
  - LLM-based classification (no keyword filtering) with a dedicated prompt template
  - Structured extraction into ExtractedNotice with detailed fields (job postings, webinars, hackathons, shortlistings, internship NOCs, reminders)
  - Retry logic with validation and error handling
  - Integration with NoticeFormatterService for standardized formatting
  - Special handling for placement policy updates via PlacementPolicyService
  - Creation of NoticeDocument for database storage and Telegram formatting
- Processing pipeline:
  - Classify -> Extract -> Validate -> Display
  - JSON extraction from LLM responses with reliable error handling
  - Advanced policy extraction with a secondary prompt for policy updates

```mermaid
flowchart TD
Start(["process_single_email"]) --> Classify["Classify (LLM)"]
Classify --> Decide{"Is relevant?"}
Decide --> |Yes| Extract["Extract (LLM)"]
Decide --> |No| Reject["Reject / Skip"]
Extract --> Validate["Validate Pydantic Model"]
Validate --> PolicyCheck{"Is policy update?"}
PolicyCheck --> |Yes| PolicyFlow["PlacementPolicyService<br/>process_policy_email"]
PolicyCheck --> |No| CreateDoc["Create NoticeDocument"]
CreateDoc --> Save["DatabaseService.save_notice"]
Save --> Done(["Return NoticeDocument"])
PolicyFlow --> Done
Reject --> Done
```

### PlacementService
- Purpose: Extract final placement offers from emails using keyword-based classification and LLM extraction.
- Key features:
  - Keyword scoring for placement-related signals, company indicators, and negative filters
  - LLM extraction with structured validation and retry logic
  - Privacy sanitization to remove headers and forwarded metadata
  - Improved validation (roles, students, packages)
  - Integration with PlacementNotificationFormatter for notification creation
- Processing pipeline:
  - Classify (keyword scoring) -> Extract (LLM) -> Validate & Improve -> Sanitize Privacy -> Display

```mermaid
flowchart TD
Start(["process_email"]) --> Classify["Keyword-based Classification"]
Classify --> Score["Score: placement/company/negative/security"]
Score --> Threshold{"Confidence >= 0.6?"}
Threshold --> |No| Reject["Reject / Non-relevant"]
Threshold --> |Yes| Extract["LLM Extraction"]
Extract --> Validate["Pydantic Validation + Enhance"]
Validate --> Privacy["Sanitize Privacy (headers, forwarded)"]
Privacy --> Events["Emit events (new/update)"]
Events --> Done(["Return PlacementOffer"])
Reject --> Done
```

### NoticeFormatterService
- Purpose: Standardize and format notices into notification-ready content using LLM prompts and LangGraph.
- Key features:
  - Text extraction from HTML content
  - Single-label classification (update, shortlisting, announcement, hackathon, webinar, job posting)
  - Fuzzy company name matching against job listings
  - Structured extraction based on category
  - Formatting into Telegram-ready messages with consistent styles and deadlines
- Processing pipeline:
  - Extract Text -> Classify -> Match Job -> Enrich Matched Job -> Extract Info -> Format Message

```mermaid
flowchart TD
Start(["format_notice"]) --> Extract["Extract Text (HTML)"]
Extract --> Classify["Classify Category (LLM)"]
Classify --> Match["Match Job (fuzzy)"]
Match --> Enrich{"Enricher callback?"}
Enrich --> |Yes| EnrichNode["Enrich Matched Job"]
Enrich --> |No| ExtractInfo["Extract Structured Info (LLM)"]
EnrichNode --> ExtractInfo
ExtractInfo --> Format["Format Message (Telegram style)"]
Format --> Done(["Return formatted_message"])
```

### PlacementNotificationFormatter
- Purpose: Create notification-ready documents for placement events (new offers and updates).
- Key features:
  - Role breakdown and counts
  - Package formatting helpers
  - New offer and update offer formatting
  - Integration with DatabaseService for persistence
- Processing:
  - NewOfferEvent -> format_new_offer_notice
  - UpdateOfferEvent -> format_update_offer_notice
  - process_events orchestrates multiple events and saves to DB

```mermaid
flowchart TD
Start(["format_event"]) --> Type{"Event type?"}
Type --> |new_offer| New["format_new_offer_notice"]
Type --> |update_offer| Update["format_update_offer_notice"]
New --> Save["DatabaseService.save_notice"]
Update --> Save
Save --> Done(["Return NoticeDocument"])
```

### PlacementPolicyService
- Purpose: Manage placement policy documents (Markdown, TOC, year extraction, CRUD).
- Key features:
  - Advanced LLM extraction for policy updates with strict JSON schema
  - Slug generation for GitHub-style TOC IDs
  - Year and update date extraction
  - Upsert operations for MongoDB
- Processing:
  - process_policy_email orchestrates extraction and persistence

```mermaid
flowchart TD
Start(["process_policy_email"]) --> Extract["ExtractedPolicyUpdate"]
Extract --> Year["Extract/Infer Year"]
Year --> Exists{"Policy exists?"}
Exists --> |Yes| Update["update_policy (merge/replace)"]
Exists --> |No| Create["create_policy"]
Update --> Persist["DatabaseService.upsert_policy"]
Create --> Persist
Persist --> Done(["Return PolicyDocument"])
```

### GoogleGroupsClient
- Purpose: Decoupled email ingestion for Google Groups using IMAP.
- Key features:
  - Connect/disconnect management
  - Fetch unread IDs and emails
  - Forwarded date and sender extraction
  - Mark as read/unread

```mermaid
classDiagram
class GoogleGroupsClient {
+connect() imap4_ssl
+disconnect() void
+get_unread_message_ids(folder) str[]
+fetch_email(email_id, folder, mark_as_read) Dict~str,str~
+fetch_unread_emails(folder, mark_as_read) Dict[]
+mark_as_read(email_id) bool
+mark_as_unread(email_id) bool
+extract_forwarded_date(text) str
+extract_forwarded_sender(text) str
}
```

### DatabaseService
- Purpose: Centralized MongoDB operations for notices, jobs, placement offers, policies, and users.
- Key features:
  - Notice CRUD and stats
  - Job upsert and retrieval
  - Placement offers save with merge logic and event emission
  - Official placement data save with content hashing
  - Policies CRUD and retrieval
  - Users management

```mermaid
classDiagram
class DatabaseService {
+notice_exists(notice_id) bool
+save_notice(notice) Tuple~bool,str~
+get_all_notices(limit) Dict[]
+get_unsent_notices() Dict[]
+mark_as_sent(post_id) bool
+upsert_structured_job(job) Tuple~bool,str~
+save_placement_offers(offers) Dict~str,Any~
+save_official_placement_data(data) void
+get_all_offers(limit) Dict[]
+get_placement_stats() Dict~str,Any~
+upsert_policy(policy) Tuple~bool,str~
+get_policy_by_year(year) Dict~str,Any~
+add_user(...) Tuple~bool,str~
+deactivate_user(user_id) bool
+get_active_users() Dict[]
}
```

## Dependency analysis
- EmailNoticeService depends on:
  - GoogleGroupsClient for email ingestion
  - NoticeFormatterService for standardized formatting
  - PlacementPolicyService for policy update handling
  - DatabaseService for persistence
- PlacementService depends on:
  - DatabaseService for saving offers and emitting events
  - PlacementNotificationFormatter for notification creation
- NoticeFormatterService depends on:
  - LLM prompts and LangGraph for classification and extraction
  - DatabaseService for job matching and enrichment
- PlacementNotificationFormatter depends on:
  - DatabaseService for saving notices
- GoogleGroupsClient is a standalone email ingestion client
- DatabaseService is a central persistence layer

```mermaid
graph LR
ENS["EmailNoticeService"] --> GGC["GoogleGroupsClient"]
ENS --> NFS["NoticeFormatterService"]
ENS --> PPS["PlacementPolicyService"]
ENS --> DB["DatabaseService"]
PS["PlacementService"] --> DB
PS --> PNF["PlacementNotificationFormatter"]
NFS --> DB
PNF --> DB
GGC --> DB
```

## Performance considerations
- LLM calls: Both EmailNoticeService and PlacementService use LLMs for extraction. Consider rate limits and cost by batching and caching where appropriate.
- Retry logic: PlacementService includes retry attempts for validation failures; EmailNoticeService retries on extraction errors up to a limit.
- IMAP operations: Fetching and parsing emails can be I/O bound; process emails sequentially to avoid connection thrashing.
- Database writes: Batch operations where possible; PlacementService's save_placement_offers merges updates efficiently.
- Formatting: NoticeFormatterService performs multiple LLM calls; cache or reuse results when feasible.

[No sources needed since this section provides general guidance]

## Troubleshooting guide
Common issues and resolutions:
- LLM JSON parsing failures:
  - PlacementService: Validates JSON and retries up to a maximum; check LLM prompt templates and content normalization.
  - EmailNoticeService: Extracts JSON from fenced blocks and retries on validation errors.
- Email fetching errors:
  - GoogleGroupsClient raises clear exceptions for missing credentials and connection failures; verify environment variables and network connectivity.
- Privacy sanitization:
  - PlacementService strips headers and forwarded markers; ensure additional_info and package details are sanitized consistently.
- Database persistence:
  - DatabaseService returns explicit success/error tuples; inspect returned messages for detailed failure reasons.
- Daemon mode:
  - Safe printing is disabled in daemon mode; rely on logging to file for visibility.

## Conclusion
The email processing services provide a reliable, LLM-powered pipeline for extracting, classifying, validating, and formatting placement and general notices. The modular design enables clear separation of concerns, strong integration with MongoDB, and extensible formatting for notifications. The orchestration in main.py demonstrates a practical approach to handling mixed email sources and ensuring reliable persistence and delivery.
