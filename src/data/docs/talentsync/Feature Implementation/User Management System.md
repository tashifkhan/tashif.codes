# User management system

## Introduction
This page describes the User Management System built with NextAuth.js, covering authentication providers, session management, role-based access control, and profile management. It explains the end-to-end user lifecycle from registration and email verification through login and role assignment, and documents the frontend components that enable user interactions. The backend integrates NextAuth.js with Prisma ORM to manage users, sessions, roles, and tokens, while the frontend provides intuitive UIs for authentication, profile editing, and role selection.

## Project structure
The user management functionality spans the frontend Next.js application and the Prisma schema:
- NextAuth.js configuration and API routes for authentication
- Prisma schema defining users, roles, sessions, and related tokens
- Frontend pages for authentication, role selection, and account management

```mermaid
graph TB
subgraph "Frontend"
A["NextAuth API<br/>app/api/auth/[...nextauth]/route.ts"]
B["Auth Options<br/>lib/auth-options.ts"]
C["Auth Page<br/>app/auth/page.tsx"]
D["Select Role Page<br/>app/select-role/page.tsx"]
E["Account Page<br/>app/account/page.tsx"]
end
subgraph "Backend Services"
F["Registration API<br/>app/api/auth/register/route.ts"]
G["Email Verification API<br/>app/api/auth/verify-email/route.ts"]
H["Update Role API<br/>app/api/auth/update-role/route.ts"]
end
subgraph "Database"
I["Prisma Schema<br/>prisma/schema.prisma"]
end
A --> B
C --> A
D --> H
E --> A
F --> I
G --> I
H --> I
B --> I
```

## Core components
- NextAuth.js configuration with multiple providers (credentials, Google, GitHub, email)
- JWT-based session strategy with callbacks for session and token synchronization
- Prisma adapter for user and session persistence
- Registration endpoint with email verification token generation
- Email verification endpoint validating tokens and marking users as verified
- Role selection and update endpoints for assigning roles post-registration
- Frontend authentication UI supporting OAuth and credentials login, plus registration with role selection
- Frontend role selection UI and account management UI for profile and security controls

## Architecture overview
The system uses NextAuth.js for authentication and Prisma for data persistence. The auth options define providers, callbacks, and session strategy. The frontend pages integrate with NextAuth hooks and call backend APIs for registration, verification, and role updates.

```mermaid
sequenceDiagram
participant U as "User"
participant FE as "Frontend Pages"
participant NA as "NextAuth API"
participant AO as "Auth Options"
participant PR as "Prisma Adapter"
participant DB as "Database"
U->>FE : "Open /auth"
FE->>NA : "Sign in with provider or credentials"
NA->>AO : "Resolve provider and callbacks"
AO->>PR : "Find/create user via adapter"
PR->>DB : "Query/Create user"
DB-->>PR : "User record"
PR-->>AO : "User object"
AO-->>NA : "Authorized user"
NA-->>FE : "Session established"
FE->>U : "Redirect to dashboard"
```

## Detailed component analysis

### NextAuth.js integration and session management
- Providers: Credentials, Google, GitHub, Email
- Session strategy: JWT
- Callbacks:
  - signIn: Enforce email verification for credentials, auto-verify OAuth users, capture profile images
  - session: Populate session.user with id and role from JWT token
  - jwt: Sync role and image from database on token creation/refresh
- Events: Automatically mark OAuth users as verified upon creation

```mermaid
flowchart TD
Start(["signIn callback"]) --> CheckProvider["Check provider type"]
CheckProvider --> IsOAuth{"OAuth provider?"}
IsOAuth --> |Yes| AutoVerify["Ensure user is verified"]
IsOAuth --> |No| CheckCredentials["Credentials provider"]
CheckCredentials --> Verified{"User verified?"}
Verified --> |No| RedirectUnverified["Redirect to /auth/verify-email"]
Verified --> |Yes| CaptureImage["Capture profile image if available"]
AutoVerify --> CaptureImage
CaptureImage --> ReturnTrue["Allow sign-in"]
```

### Authentication flow: registration, verification, login
- Registration:
  - Validates input, checks existing user and role, hashes password, creates user and verification token in a transaction, and attempts to send a verification email
- Email Verification:
  - Validates token existence and expiration, marks user as verified, and records confirmation
- Login:
  - Supports OAuth providers and credentials; credentials require email verification

```mermaid
sequenceDiagram
participant U as "User"
participant FE as "Frontend"
participant REG as "POST /api/auth/register"
participant VER as "POST /api/auth/verify-email"
participant NA as "NextAuth API"
U->>FE : "Submit registration form"
FE->>REG : "Create user and verification token"
REG-->>FE : "Success with verification email"
U->>VER : "Click verification link"
VER-->>U : "Verification success"
U->>NA : "Sign in with credentials/OAuth"
NA-->>U : "Authenticated session"
```

### Role-Based access control and role selection
- Roles are stored in the Role model and linked to users via roleId
- On OAuth sign-in, users are auto-verified; on credentials sign-in, email verification is enforced
- After initial sign-in, users land on a role selection page where they choose "User" or "Recruiter"
- The role is persisted in the database and synchronized into JWT and session via callbacks
- The frontend displays role-aware UI and redirects appropriately

```mermaid
flowchart TD
SignIn["User signed in"] --> HasRole{"Has role assigned?"}
HasRole --> |No| SelectRole["Redirect to /select-role"]
HasRole --> |Yes| Dashboard["Redirect to /dashboard"]
SelectRole --> UpdateRole["POST /api/auth/update-role"]
UpdateRole --> RefreshSession["Refresh session with new role"]
RefreshSession --> Dashboard
```

### Profile management features
- Avatar management:
  - For email-authenticated users, an upload component allows custom avatar URLs
  - OAuth users use profile images from their OAuth provider
- Personal information:
  - Displayed on the account page; editable via future extensions
- Role updates:
  - Role can be changed through the role selection page and reflected in session
- Security actions:
  - Password reset initiation for email-authenticated users
  - Account deletion with confirmation

```mermaid
classDiagram
class User {
+string id
+string name
+string email
+string image
+boolean isVerified
+string roleId
}
class Role {
+string id
+string name
}
class Session {
+string id
+string sessionToken
+DateTime expires
}
User --> Role : "belongsTo"
User --> Session : "hasMany"
```

### Frontend components for authentication and profile management
- Authentication page:
  - Tabs for login and register
  - OAuth buttons for Google and GitHub
  - Credentials login with validation
  - Registration with role selection and avatar URL validation
- Role selection page:
  - Radio buttons for "User" and "Recruiter"
  - Updates role via API and refreshes session
- Account page:
  - Displays profile info and role
  - Manages avatar (upload for email users)
  - Initiates password reset and account deletion

### Database schema for users, sessions, and roles
- Role model defines unique role names and links to users
- User model includes optional password hash for credentials, email verification flag, optional role linkage, and profile fields
- Session model stores session tokens and expiry
- Additional token models support email verification and password resets

```mermaid
erDiagram
ROLE {
string id PK
string name UK
}
USER {
string id PK
string name
string email
datetime emailVerified
string image
string passwordHash
boolean isVerified
string roleId FK
}
SESSION {
string id PK
string sessionToken UK
datetime expires
string userId FK
}
ROLE ||--o{ USER : "has many"
USER ||--o{ SESSION : "has many"
```

### Implementing custom authentication providers and extending capabilities
- Custom provider integration:
  - Add a new provider in the NextAuth options array and implement authorize logic to validate credentials and return a user object with id, email, name, image, and role
- Extending user capabilities:
  - Add fields to the User model in the Prisma schema
  - Update the JWT and session callbacks to propagate new fields
  - Extend frontend components to collect and display new user attributes

[No sources needed since this section provides general guidance]

## Dependency analysis
- NextAuth.js depends on the Prisma adapter and the configured providers
- Backend APIs depend on Prisma client for database operations
- Frontend pages depend on NextAuth hooks and call backend endpoints

```mermaid
graph LR
AO["Auth Options"] --> AD["Prisma Adapter"]
AD --> PC["Prisma Client"]
PC --> DB["Database"]
FE1["Auth Page"] --> NA["NextAuth API"]
FE2["Select Role Page"] --> UR["Update Role API"]
FE3["Account Page"] --> NA
UR --> PC
REG["Registration API"] --> PC
VER["Verification API"] --> PC
```

## Performance considerations
- Use JWT-based sessions to avoid frequent database reads
- Keep token refresh callbacks minimal; fetch only necessary user fields
- Batch database operations (e.g., registration transaction) to reduce round-trips
- Cache frequently accessed role and user metadata where appropriate

[No sources needed since this section provides general guidance]

## Troubleshooting guide
- Email verification failures:
  - Ensure the verification token exists, is unexpired, and not already confirmed
- Credentials login blocked:
  - Verify that the user's email is marked as verified before allowing sign-in
- Role update errors:
  - Confirm the incoming roleId maps to a valid Role name in the database
- OAuth sign-in issues:
  - Confirm provider credentials are configured and user image/profile picture is captured when missing

## Conclusion
The User Management System integrates NextAuth.js with Prisma to provide reliable authentication, email verification, role-based access control, and profile management. The frontend offers intuitive UIs for registration, verification, role selection, and account settings, while the backend ensures secure and reliable user lifecycle management. Extensibility is supported through custom providers and schema enhancements.
