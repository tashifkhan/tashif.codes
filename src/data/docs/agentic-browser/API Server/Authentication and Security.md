# Authentication and security

## Introduction
This page provides detailed authentication and security documentation for the API server. It explains how authentication is applied across routers, documents the use of API keys, OAuth flows, session management, security headers, CORS policies, rate limiting strategies, JWT token handling, credential storage, and secure communication protocols. It also outlines security best practices, vulnerability prevention measures, and compliance considerations, along with mitigation strategies for common security threats across service integrations.

## Project structure
The API server is implemented using FastAPI and exposes multiple routers under a unified application. Routers are grouped by functional domains (e.g., health, GitHub, Gmail, Google Search, website, YouTube, PyjIIT, React Agent, website validator, browser use, file upload). Each router defines endpoints and delegates business logic to dedicated services. Environment variables are loaded via a configuration module, and the application entrypoint supports selecting between API and MCP modes.

```mermaid
graph TB
A_main["main.py<br/>Entry point"] --> B_api_run["api/main.py<br/>FastAPI app"]
B_api_run --> C_routers["routers/*<br/>Routers per domain"]
C_routers --> D_services["services/*<br/>Domain services"]
B_api_run --> E_config["core/config.py<br/>Environment and logging"]
```

## Core components
- API Application: Initializes the FastAPI app, registers routers, and exposes endpoints under standardized prefixes.
- Routers: Define request validation, error handling, and route-specific behaviors. They depend on services for business logic.
- Services: Encapsulate integration with external APIs and tools, including credential handling and error propagation.
- Configuration: Loads environment variables and sets logging levels.

Key observations:
- No global authentication middleware is present in the API application.
- Some endpoints accept credentials directly in request bodies (e.g., access tokens).
- Environment variables are used for API keys and runtime configuration.

## Architecture overview
The API server architecture separates concerns into routers, services, and configuration. Routers handle HTTP requests and validation, services encapsulate integrations, and configuration manages environment-driven behavior.

```mermaid
graph TB
subgraph "API Layer"
R_health["routers/health.py"]
R_github["routers/github.py"]
R_gmail["routers/gmail.py"]
R_google_search["routers/google_search.py"]
R_website["routers/website.py"]
end
subgraph "Service Layer"
S_github["services/github_service.py"]
S_gmail["services/gmail_service.py"]
S_google_search["services/google_search_service.py"]
S_website["services/website_service.py"]
end
subgraph "Config"
C_cfg["core/config.py"]
end
R_health --> S_github
R_github --> S_github
R_gmail --> S_gmail
R_google_search --> S_google_search
R_website --> S_website
C_cfg --> S_github
C_cfg --> S_website
```

## Detailed component analysis

### Health endpoint
- Purpose: Lightweight health check without authentication.
- Behavior: Returns a simple health status object.
- Security: Public endpoint; no authentication or authorization enforced.

### GitHub router
- Purpose: Processes GitHub repository queries and optional file attachments.
- Authentication: Accepts a URL and question; no explicit authentication enforced at router level.
- Credential Handling: When an attached file is present, the service uses an API key retrieved from environment variables to communicate with an external provider.
- Error Handling: Validates presence of required fields and returns structured errors.

```mermaid
sequenceDiagram
participant Client as "Client"
participant Router as "routers/github.py"
participant Service as "services/github_service.py"
Client->>Router : "POST /api/genai/github/"
Router->>Router : "Validate request fields"
alt "Attached file present"
Router->>Service : "generate_answer(..., attached_file_path)"
Service->>Service : "Load GOOGLE_API_KEY/GEMINI_API_KEY"
Service-->>Router : "LLM response"
else "No attached file"
Router->>Service : "generate_answer(...)"
Service-->>Router : "LLM response"
end
Router-->>Client : "200 OK with content"
```

### Gmail router
- Purpose: Provides operations against Gmail using an access token supplied in the request body.
- Authentication: Requires an access token for all endpoints; validated at router level.
- Endpoints:
  - List unread messages
  - Fetch latest messages
  - Mark message read
  - Send email
- Error Handling: Enforces required fields and returns structured errors.

```mermaid
sequenceDiagram
participant Client as "Client"
participant Router as "routers/gmail.py"
participant Service as "services/gmail_service.py"
Client->>Router : "POST /api/gmail/unread | latest | mark_read | send"
Router->>Router : "Validate access_token and other fields"
Router->>Service : "Delegate operation with access_token"
Service-->>Router : "Operation result"
Router-->>Client : "200 OK with result"
```

### Google search router
- Purpose: Executes web search queries via a pipeline.
- Authentication: No authentication enforced at router level.
- Behavior: Validates query presence and returns results.

### Website router
- Purpose: Generates answers based on website content and optional client-provided HTML.
- Authentication: No authentication enforced at router level.
- Credential Handling: When an attached file is present, the service uses an API key retrieved from environment variables to communicate with an external provider.

### API key validation and credential storage
- API Keys: The GitHub and Website services load an API key from environment variables to interact with external providers when processing attached files.
- Credential Storage: Credentials are not stored server-side; access tokens are passed in request bodies and used immediately by services.
- Frontend Settings: The extension allows users to store API keys locally and manage tokens, including refresh flows.

```mermaid
flowchart TD
Start(["Client Request"]) --> CheckFields["Validate Required Fields"]
CheckFields --> FieldsOK{"Fields Valid?"}
FieldsOK --> |No| Return400["Return 400 Bad Request"]
FieldsOK --> |Yes| HasFile{"Attached File?"}
HasFile --> |Yes| LoadKey["Load API Key from Environment"]
LoadKey --> CallExternal["Call External Provider"]
CallExternal --> Return200["Return 200 OK"]
HasFile --> |No| CallLLM["Invoke Local/Embedded LLM"]
CallLLM --> Return200
Return400 --> End(["End"])
Return200 --> End
```

### OAuth flows and session management
- OAuth Access Tokens: The Gmail router requires an access token in the request body for all operations.
- Session Management: There is no persistent session management or refresh token handling in the API server. The extension indicates support for refresh tokens and manual refresh actions, suggesting client-side token lifecycle management.
- JWT Handling: No JWT tokens are processed by the API server; authentication relies on bearer-style access tokens passed in request bodies.

### Security headers, CORS policies, and rate limiting
- Security Headers: Not configured in the API application.
- CORS: Not configured in the API application.
- Rate Limiting: Not configured in the API application.
Recommendations:
- Add CORS middleware to restrict origins and methods.
- Add security headers (e.g., Content-Security-Policy, Strict-Transport-Security).
- Implement rate limiting at the router or application level.

### Secure communication protocols
- Transport Security: The extension demonstrates local HTTP usage for internal services, which is acceptable for development. Production deployments should enforce HTTPS/TLS termination at ingress/load balancer.
- Internal Communication: The extension's fetch calls target localhost endpoints; ensure network isolation and consider loopback security boundaries.

## Dependency analysis
Routers depend on services for business logic. Services depend on configuration for environment variables and on external tools. There is no central authentication dependency injected into the application.

```mermaid
graph LR
R_health["routers/health.py"] --> S_github["services/github_service.py"]
R_github["routers/github.py"] --> S_github
R_gmail["routers/gmail.py"] --> S_gmail["services/gmail_service.py"]
R_google_search["routers/google_search.py"] --> S_google_search["services/google_search_service.py"]
R_website["routers/website.py"] --> S_website["services/website_service.py"]
C_cfg["core/config.py"] --> S_github
C_cfg --> S_website
```

## Performance considerations
- Avoid unnecessary external calls when no attached file is present.
- Cache or reuse external client instances where appropriate to reduce overhead.
- Validate and sanitize inputs early to fail fast and reduce downstream processing.

## Security controls and best practices

### Authentication mechanisms
- API Key Validation
  - Use environment variables to store API keys.
  - Restrict API key scopes and rotate keys periodically.
  - Avoid logging sensitive values.
- OAuth Flows
  - Accept access tokens in request bodies for endpoints requiring third-party authorization.
  - Validate token audience and expiration when possible.
- Session Management
  - No server-side sessions; rely on client-managed tokens.
  - Implement token refresh logic in the client and avoid long-lived tokens.

### Security headers, CORS, and rate limiting
- Configure CORS to allowlist trusted origins and methods.
- Apply security headers to mitigate common attacks (X-Content-Type-Options, X-Frame-Options, Referrer-Policy).
- Implement rate limiting per endpoint or globally to prevent abuse.

### JWT token handling
- Not applicable in current implementation; if introduced, use short-lived access tokens and long-lived refresh tokens with secure storage and transport.

### Credential storage
- Store secrets in environment variables or secret managers.
- Never persist tokens or API keys in plaintext logs or databases.
- Use encrypted storage for sensitive settings in the extension.

### Secure communication protocols
- Enforce TLS termination at ingress for production.
- Use HTTPS for all internal and external communications.

### Compliance considerations
- Data minimization: Only collect and process necessary data.
- Privacy controls: Respect user privacy and provide opt-out mechanisms.
- Logging hygiene: Avoid logging PII or secrets.

### Vulnerability prevention measures
- Input validation and sanitization at router level.
- Principle of least privilege for external API keys.
- Timeout and retry policies for external calls.
- Circuit breaker patterns to protect downstream systems.

### Threat mitigation strategies
- Injection Attacks: Validate and sanitize inputs; avoid dynamic evaluation.
- Information Disclosure: Avoid exposing stack traces; return generic error messages.
- Abuse and DoS: Implement rate limiting and request size limits.
- Man-in-the-Middle: Enforce TLS and certificate pinning where applicable.

## Troubleshooting guide
- Missing Access Token (Gmail): Ensure the request includes a valid access token; otherwise, the router returns a 400 error.
- Invalid or Expired Access Token (Gmail): The underlying service may raise exceptions; wrap and translate to user-friendly errors.
- Session Errors (PyjIIT): Exceptions indicate session-related issues; surface actionable messages to users.
- Health Endpoint: Use the health endpoint to confirm service availability.

## Conclusion
The API server currently relies on request-time validation and environment-based API keys for external integrations, with no global authentication middleware. To harden the system, deploy CORS and security headers, implement rate limiting, and adopt reliable token management practices. The extension's token management capabilities complement server-side improvements to deliver a secure and compliant solution.
