# Bulk upload and admin data

## Introduction
This page explains the Bulk Upload and Admin data models in the TalentSync application, focusing on:
- BulkUpload: administrative file upload tracking, success/failure metrics, and batch processing status
- Recruiter: administrator/recruiter profiles with company information and administrative privileges
- Relationship patterns between admin users and bulk upload operations
- File management workflows, upload progress tracking, and error handling
- Administrative access controls, role-based permissions, and audit trail requirements
- Security considerations for file uploads, virus scanning integration, and data validation for batch processing
- Integration with the resume analysis pipeline for automated processing of uploaded files and notification systems for upload completion status

## Project structure
The data model is defined in the frontend Prisma schema and enforced via database migrations. The frontend Next.js API routes expose administrative capabilities for recruiters, while the backend FastAPI application orchestrates file processing and integrates with the resume analysis pipeline.

```mermaid
graph TB
subgraph "Frontend"
PRISMA["Prisma Schema<br/>schema.prisma"]
MIGR["Migration<br/>20250612211318_init/migration.sql"]
SEED["Seed Roles<br/>seed.ts"]
API_ROUTE["Recruiter API Route<br/>/api/recruter/show-all/route.ts"]
SERVICE["Recruiter Service<br/>recruiter.service.ts"]
NAVBAR["Navbar<br/>navbar.tsx"]
ROLESEL["Select Role UI<br/>select-role/page.tsx"]
UPLOADCOMP["Upload Component<br/>upload-resume.tsx"]
end
subgraph "Backend"
FASTAPI["FastAPI App<br/>main.py"]
ANALYSIS_ROUTE["Analysis Route<br/>/api/(backend-interface)/analysis/route.ts"]
RESUME_SERVER["Resume Server<br/>server.py"]
end
PRISMA --> MIGR
PRISMA --> SEED
API_ROUTE --> SERVICE
NAVBAR --> API_ROUTE
ROLESEL --> API_ROUTE
UPLOADCOMP --> ANALYSIS_ROUTE
ANALYSIS_ROUTE --> RESUME_SERVER
FASTAPI --> ANALYSIS_ROUTE
```

## Core components
- BulkUpload model
  - Tracks administrative uploads with file metadata, counts of processed files, and timestamps
  - Links uploads to an admin user via a foreign key
- Recruiter model
  - Stores recruiter/admin profiles with company information and a unique link to the admin user
- Roles and access control
  - Seed script creates default roles including Admin
  - UI reflects Admin as "Recruiter" for user-facing labeling
- API exposure
  - Recruiter dashboard endpoint retrieves centralized resumes with optional filters
  - Frontend service consumes the endpoint to display recruiter data

## Architecture overview
The system separates concerns across frontend, backend, and database layers:
- Frontend Prisma schema defines models and relationships
- Frontend API routes enforce access checks and expose administrative endpoints
- Backend FastAPI app registers routes and delegates file processing
- Resume analysis pipeline handles file ingestion, cleaning, and structured extraction

```mermaid
sequenceDiagram
participant UI as "Recruiter UI"
participant FE as "Next.js API Route"
participant BE as "FastAPI App"
participant PIPE as "Resume Server"
UI->>FE : "GET /api/recruter/show-all?centralOnly=true&search=..."
FE-->>UI : "JSON { success, data : { resumes[], total } }"
UI->>BE : "POST /api/(backend-interface)/analysis"
BE->>PIPE : "Forward file and metadata"
PIPE-->>BE : "Structured analysis response"
BE-->>UI : "Upload & analysis result"
```

## Detailed component analysis

### BulkUpload model
Purpose:
- Track administrative bulk file uploads
- Maintain counts of successful and failed files per batch
- Associate uploads with the admin who initiated them

Fields and relationships:
- id: unique identifier
- adminId: foreign key to User (admin)
- fileUrl: storage location of the uploaded file
- totalFiles: total number of files in the batch
- succeeded: count of successfully processed files
- failed: count of failed files
- uploadedAt: creation timestamp

Processing logic:
- On successful processing, increment succeeded
- On failure, increment failed
- Batch status can be inferred from succeeded + failed vs totalFiles

```mermaid
erDiagram
USER {
string id PK
string name
string email UK
string roleId FK
}
BULKUPLOAD {
string id PK
string adminId FK
string fileUrl
int totalFiles
int succeeded
int failed
timestamp uploadedAt
}
USER ||--o{ BULKUPLOAD : "uploads"
```

### Recruiter model
Purpose:
- Store administrator/recruiter profiles with company information
- Provide a unique link to the admin User record

Fields and relationships:
- id: unique identifier
- adminId: unique foreign key to User (admin)
- email: recruiter's email
- companyName: associated company
- createdAt: creation timestamp

Integration:
- Recruiter records are deleted when an admin user account is removed
- UI displays "Recruiter" for Admin role

```mermaid
erDiagram
USER {
string id PK
string name
string email UK
string roleId FK
}
RECRUITER {
string id PK
string adminId UK FK
string email
string companyName
timestamp createdAt
}
USER ||--o| RECRUITER : "has profile"
```

### Administrative access controls and role-based permissions
- Roles are seeded with default entries including Admin
- UI maps Admin to "Recruiter" for display
- Recruiter dashboard endpoint currently has commented access checks; future development should enforce Admin/Recruiter role validation

```mermaid
flowchart TD
Start(["User selects role"]) --> CheckSession["Check session"]
CheckSession --> IsAdmin{"Role is Admin?"}
IsAdmin --> |Yes| AssignRecruiter["Assign Recruiter role"]
IsAdmin --> |No| DenyAccess["Deny access or redirect"]
AssignRecruiter --> Redirect["Redirect to dashboard"]
```

### File management workflows and upload progress tracking
- Single-file upload and analysis flow:
  - Frontend component collects file, custom name, and visibility preference
  - Next.js route validates presence of file and custom name
  - Backend FastAPI app registers analysis routes
  - Resume server performs cleaning and structured extraction
- Progress indication:
  - Frontend component shows "Analyzing..." during submission
- Centralized resume retrieval:
  - Recruiter API route supports filtering by central-only flag and search term

```mermaid
sequenceDiagram
participant Uploader as "Upload Component"
participant API as "Analysis Route"
participant FA as "FastAPI"
participant RS as "Resume Server"
Uploader->>API : "FormData(file, customName, showInCentral)"
API->>FA : "Forward request"
FA->>RS : "Process file"
RS-->>FA : "Analysis result"
FA-->>API : "Response"
API-->>Uploader : "Success or error"
```

### Error handling mechanisms
- Frontend routes log backend errors and attempt to parse JSON error messages
- Frontend falls back to extracting meaningful info from HTML error responses
- Backend FastAPI logs request/response payloads for observability

```mermaid
flowchart TD
A["Backend error response"] --> B{"JSON parseable?"}
B --> |Yes| C["Extract detail/message"]
B --> |No| D{"HTML response?"}
D --> |Yes| E["Extract title/h1"]
D --> |No| F["Fallback generic message"]
C --> G["Return to frontend"]
E --> G
F --> G
```

### Audit trail requirements for bulk operations
- BulkUpload tracks uploadedAt for auditability
- Recruiter records are deleted alongside admin user deletion, ensuring referential cleanup
- Future enhancements could include:
  - Operation logs with adminId, fileUrl, counts, and timestamps
  - Status transitions (queued, processing, completed, failed)
  - Metadata for each processed file (original filename, size, processing duration)

### Security considerations for file uploads
- File type validation:
  - Restrict accepted MIME types and extensions
  - Reject unknown or potentially unsafe formats
- Virus scanning integration:
  - Integrate with an external AV service prior to processing
  - Block uploads until scan completes and returns clean status
- Data validation:
  - Validate customName presence and length limits
  - Enforce showInCentral boolean semantics
- Access control:
  - Enforce Admin/Recruiter role checks in API routes
  - Scope retrievals to authorized users

### Notification systems for upload completion status
- Centralized resume retrieval supports a "centralOnly" filter for downstream notifications
- Recruiter service fetches resumes and totals for UI updates
- Suggested enhancement:
  - Emit events upon BulkUpload completion (success/failure thresholds met)
  - Notify admins via in-app notifications or email

## Dependency analysis
- Prisma schema defines models and foreign keys
- Migrations enforce primary and unique constraints
- Seed script initializes roles
- API routes depend on session and role checks
- Frontend components depend on API routes and services
- Backend FastAPI app depends on registered routers for file processing

```mermaid
graph LR
SCHEMA["schema.prisma"] --> MIG["migration.sql"]
SCHEMA --> SEED["seed.ts"]
API["recruter/show-all/route.ts"] --> SVC["recruiter.service.ts"]
UI["upload-resume.tsx"] --> API
API --> BE["main.py"]
BE --> PIPE["server.py"]
```

## Performance considerations
- Asynchronous processing:
  - Offload heavy file processing to background tasks or separate services
- Concurrency limits:
  - Gate concurrent uploads per admin to prevent resource exhaustion
- Caching:
  - Cache frequently accessed centralized resumes for reduced DB load
- Observability:
  - Use request/response logging and structured metrics for latency and throughput

## Troubleshooting guide
- Authentication failures:
  - Verify session presence and role mapping
- Access denials:
  - Confirm Admin/Recruiter role checks are enabled in API routes
- Upload errors:
  - Check file type validation and size limits
  - Inspect backend error logs for detailed messages
- Cleanup issues:
  - Ensure Recruiter records are deleted with admin user removal

## Conclusion
The BulkUpload and Recruiter models provide a foundation for administrative file ingestion and recruiter profile management. The frontend API routes and services enable centralized resume retrieval and UI integration, while the backend FastAPI app and resume analysis pipeline handle file processing. To meet production requirements, implement reliable access controls, file validation, virus scanning, and detailed audit trails, along with scalable error handling and notification systems.
