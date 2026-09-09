# Authentication system

## Introduction
This page describes the OTP-based authentication system used by the application. It explains the authentication context implementation, session management, and user state handling. It documents the OTP login flow, JWT token management, and cookie-based authentication persistence. It also covers authentication hooks, protected route handling, and the user session lifecycle. API integration patterns for authentication endpoints, error handling strategies, and security considerations are included, along with logout functionality, token refresh mechanisms, and authentication state synchronization across the application.

## Project structure
The authentication system spans two primary areas:
- Frontend (Next.js app): Provides the authentication context, UI flows, and protected routing.
- Backend (FastAPI service): Implements OTP generation and verification, JWT issuance, refresh token rotation, and cookie management.

```mermaid
graph TB
subgraph "Frontend (Next.js)"
AC["AuthContext<br/>website/lib/auth-context.tsx"]
API["API Client<br/>website/lib/api.ts"]
LG["Login Page<br/>website/app/notice-reminders/login/page.tsx"]
AG["Auth Guard<br/>website/components/auth-guard.tsx"]
TY["Types<br/>website/lib/types.ts"]
end
subgraph "Backend (FastAPI)"
AR["Auth Router<br/>notice-reminders/app/api/routers/auth.py"]
CO["Auth Utilities<br/>notice-reminders/app/core/auth.py"]
AS["AuthService<br/>notice-reminders/app/services/auth_service.py"]
CFG["Settings<br/>notice-reminders/app/core/config.py"]
OTPM["OTP Model<br/>notice-reminders/app/models/otp.py"]
RTM["Refresh Token Model<br/>notice-reminders/app/models/refresh_token.py"]
USM["User Model<br/>notice-reminders/app/models/user.py"]
OTPE["OTP Email Service<br/>notice-reminders/app/services/otp_email_service.py"]
SCU["User Schema<br/>notice-reminders/app/schemas/user.py"]
SCA["Auth Schemas<br/>notice-reminders/app/schemas/auth.py"]
end
LG --> AC
AC --> API
API --> AR
AR --> AS
AS --> OTPM
AS --> RTM
AS --> USM
AS --> OTPE
AR --> CO
CO --> SCU
AC --> AG
API --> TY
AS --> CFG
AR --> SCA
```

## Core components
- Authentication Context (frontend): Manages user state, loading state, OTP request/verification, logout, and session refresh. It initializes by loading the current user session on mount.
- API Client (frontend): Encapsulates HTTP requests to backend endpoints, handles credentials, and parses responses.
- Login Page (frontend): Implements the OTP-based sign-in flow with step transitions and validation.
- Auth Guard (frontend): Protects routes by redirecting unauthenticated users to the login page while handling loading states.
- Auth Router (backend): Exposes endpoints for OTP request, OTP verification, token refresh, logout, and fetching the current user.
- Auth Utilities (backend): Extracts and validates JWT access tokens from cookies for protected routes.
- AuthService (backend): Orchestrates OTP lifecycle, JWT creation/verification, refresh token creation/rotation/revoke, and user provisioning.
- Models and Schemas (backend): Define OTP codes, refresh tokens, users, and Pydantic models for request/response validation.
- Configuration (backend): Centralizes JWT, OTP, and SMTP settings.

## Architecture overview
The system uses cookie-based authentication with short-lived access tokens and long-lived refresh tokens. The frontend authenticates via OTP, receives JWT cookies, and uses them for subsequent authenticated requests. The backend validates access tokens from cookies and provides refresh and logout endpoints.

```mermaid
sequenceDiagram
participant U as "User"
participant FE as "Frontend<br/>AuthContext/API Client"
participant BE as "Backend<br/>Auth Router"
participant AS as "AuthService"
participant DB as "Models/Schemas"
U->>FE : "Open Login Page"
FE->>BE : "POST /auth/request-otp"
BE->>AS : "request_otp(email)"
AS->>DB : "Create OTP record"
AS->>DB : "Send OTP via email"
BE-->>FE : "OtpRequestResponse"
U->>FE : "Submit OTP"
FE->>BE : "POST /auth/verify-otp"
BE->>AS : "verify_otp(email, code)"
AS->>DB : "Find unused, unexpired OTP"
AS->>DB : "Create or fetch User"
AS->>AS : "create_access_token(user)"
AS->>DB : "create_refresh_token(user)"
BE-->>FE : "AuthStatus + Set Cookies(access_token, refresh_token)"
U->>FE : "Navigate to protected route"
FE->>BE : "GET /auth/me (with cookies)"
BE->>AS : "verify_access_token(token)"
AS-->>BE : "Payload(sub, exp, iat)"
BE-->>FE : "UserResponse"
U->>FE : "Trigger refresh"
FE->>BE : "POST /auth/refresh (with refresh_token cookie)"
BE->>AS : "validate_refresh_token(token)"
AS->>DB : "rotate_refresh_token()"
AS->>AS : "create_access_token(user)"
BE-->>FE : "AuthStatus + Updated Cookies"
U->>FE : "Logout"
FE->>BE : "POST /auth/logout (with refresh_token cookie)"
BE->>AS : "revoke_refresh_token(token)"
BE-->>FE : "Delete Cookies"
```

## Detailed component analysis

### Authentication context (frontend)
Responsibilities:
- Initialize session by fetching the current user on mount.
- Provide OTP request and verification functions.
- Manage user state, loading state, and authentication status.
- Handle logout by calling backend and resetting state.
- Refresh session by validating and updating user state.

Key behaviors:
- On mount, attempts to load the current user and sets loading state accordingly.
- OTP request delegates to the API client.
- OTP verification updates user state and returns authentication status.
- Logout clears user state and redirects to the login route.
- Refresh attempts to renew session and update user state; on failure, clears state.

```mermaid
flowchart TD
Start(["Mount AuthProvider"]) --> Load["Call getMe()"]
Load --> Success{"getMe() ok?"}
Success --> |Yes| SetUser["Set user state"]
Success --> |No| SetNull["Set user=null"]
SetUser --> Done(["Finish init"])
SetNull --> Done
```

### API client (frontend)
Responsibilities:
- Centralized HTTP client with credential inclusion for cross-site cookies.
- Unified error handling via a typed APIError.
- Specific functions for OTP request, OTP verification, session refresh, logout, and fetching current user.

Key behaviors:
- All requests include credentials to support cookie-based auth.
- Non-OK responses raise APIError with status and message.
- 204 responses are handled as no-content.

Integration patterns:
- requestOtp(email) → POST /auth/request-otp
- verifyOtp(email, code) → POST /auth/verify-otp
- refreshSession() → POST /auth/refresh
- logout() → POST /auth/logout
- getMe() → GET /auth/me

### Login page (frontend)
Responsibilities:
- Two-step OTP flow: request OTP and verify OTP.
- Form validation for email and code.
- Navigation to dashboard upon successful authentication.
- Loading states and error messaging.

Flow:
- Enter email and submit to request OTP; transitions to code step.
- Enter six-digit code and submit to verify OTP; navigates to dashboard on success.

```mermaid
flowchart TD
E["Enter Email"] --> Req["Request OTP"]
Req --> Code["Enter 6-digit Code"]
Code --> Verify["Verify OTP"]
Verify --> Ok{"Success?"}
Ok --> |Yes| Dash["Redirect to Dashboard"]
Ok --> |No| Err["Show Error Message"]
```

### Auth guard (frontend)
Responsibilities:
- Protect routes by checking authentication state and loading status.
- Redirect unauthenticated users to the login page.
- Render a loader while resolving authentication state.

Behavior:
- On change of loading or authentication state, enforces redirect if not authenticated.

### Backend authentication router
Endpoints:
- POST /auth/request-otp: Creates OTP record and sends code; indicates if user is new.
- POST /auth/verify-otp: Verifies OTP, creates access and refresh tokens, sets cookies.
- POST /auth/refresh: Validates refresh token, rotates it, issues new access token, updates cookies.
- POST /auth/logout: Revokes refresh token and deletes cookies.
- GET /auth/me: Returns current user after extracting access token from cookies.

Cookie policy:
- access_token: HttpOnly, SameSite=Lax, Path=/, Secure unless debug.
- refresh_token: HttpOnly, SameSite=Lax, Path=/, Secure unless debug.

### Access token validation (backend)
- Extracts access_token from cookies.
- Raises 401 for missing token or invalid/expired payloads.
- Resolves user ID from token payload and loads user from database.

### AuthService (backend)
Responsibilities:
- OTP lifecycle: generate code, persist OTP, send via email service.
- User provisioning: create user if not exists.
- JWT lifecycle: create access token with subject, email, exp, iat; verify access token.
- Refresh token lifecycle: create refresh token, rotate (invalidate old and issue new), validate, revoke.

Security and correctness:
- OTP uniqueness per email and expiration enforcement.
- Refresh token revocation on logout and rotation on refresh.
- Strict validation of token presence and expiration.

### Models and schemas (backend)
- User: unique email, optional profile fields, timestamps.
- OtpCode: email, code, expiration, usage flag, timestamps.
- RefreshToken: foreign key to User, unique token, expiration, revoked flag, timestamps.
- Auth schemas: OtpRequest, OtpVerify, AuthStatus, OtpRequestResponse.
- UserResponse schema for serialization.

### Configuration (backend)
- JWT secret and expiry windows for access and refresh tokens.
- OTP expiry window and length.
- SMTP settings for OTP delivery; console fallback.

### OTP delivery service (backend)
- Console output for development.
- SMTP transport for production with validation of required settings.

## Dependency analysis
High-level dependencies:
- Frontend depends on backend endpoints and shared types.
- Backend endpoints depend on AuthService, Tortoise ORM models, and Pydantic schemas.
- AuthService depends on configuration, email service, and models.

```mermaid
graph LR
FE_CTX["AuthContext<br/>website/lib/auth-context.tsx"] --> FE_API["API Client<br/>website/lib/api.ts"]
FE_PG["Login Page<br/>website/app/notice-reminders/login/page.tsx"] --> FE_CTX
FE_GUARD["Auth Guard<br/>website/components/auth-guard.tsx"] --> FE_CTX
FE_API --> BE_AUTHR["Auth Router<br/>notice-reminders/app/api/routers/auth.py"]
BE_AUTHR --> BE_AS["AuthService<br/>notice-reminders/app/services/auth_service.py"]
BE_AS --> BE_CFG["Settings<br/>notice-reminders/app/core/config.py"]
BE_AS --> BE_OTP["OtpCode Model<br/>notice-reminders/app/models/otp.py"]
BE_AS --> BE_RT["RefreshToken Model<br/>notice-reminders/app/models/refresh_token.py"]
BE_AS --> BE_US["User Model<br/>notice-reminders/app/models/user.py"]
BE_AS --> BE_OTPE["OTP Email Service<br/>notice-reminders/app/services/otp_email_service.py"]
BE_AUTHR --> BE_CORE["Auth Utils<br/>notice-reminders/app/core/auth.py"]
BE_AUTHR --> BE_SCU["User Schema<br/>notice-reminders/app/schemas/user.py"]
BE_AUTHR --> BE_SCA["Auth Schemas<br/>notice-reminders/app/schemas/auth.py"]
```

## Performance considerations
- Token lifetimes: Access tokens are short-lived; refresh tokens are long-lived but rotated on each refresh to limit exposure.
- OTP validity: OTPs expire quickly to reduce risk window.
- Cookie policy: HttpOnly and SameSite=Lax improve protection against XSS and CSRF; Secure flag is disabled in debug mode.
- Network efficiency: Frontend reuses a single API client with credentials; backend avoids redundant lookups by validating tokens and OTPs efficiently.
- Database queries: OTP retrieval filters by email, code, unused, and expiration; refresh token validation checks revocation and expiry.

[No sources needed since this section provides general guidance]

## Troubleshooting guide
Common issues and resolutions:
- Missing or expired access token: Ensure cookies are present and not expired; trigger refresh if needed.
- Invalid or expired OTP: Re-request OTP; confirm delivery and expiration window.
- Refresh token errors: Missing or revoked/expired refresh token requires re-authentication.
- Logout not taking effect: Confirm cookies are deleted and refresh token is revoked.
- API errors: Inspect APIError status and message returned by the client.

Error handling patterns:
- Frontend: APIError with status and message; display user-friendly messages.
- Backend: HTTPException with appropriate status codes for missing/invalid/expired tokens and OTPs.

## Conclusion
The authentication system combines a reliable backend with cookie-based JWT tokens and a streamlined frontend OTP flow. It emphasizes security through short-lived access tokens, refresh token rotation, OTP expiration, and strict validation. The frontend provides a clear user experience with guarded routes and centralized state management, while the backend ensures reliable session persistence and secure token lifecycle management.

[No sources needed since this section summarizes without analyzing specific files]

## Appendices

### Authentication lifecycle summary
- OTP Request: Generates and persists OTP; sends via configured channel.
- OTP Verification: Validates OTP, provisions user if needed, issues access and refresh tokens, sets cookies.
- Protected Routes: Access token extracted from cookies; validated before allowing access.
- Session Refresh: Validates refresh token, rotates it, issues new access token, updates cookies.
- Logout: Revokes refresh token and clears cookies.
