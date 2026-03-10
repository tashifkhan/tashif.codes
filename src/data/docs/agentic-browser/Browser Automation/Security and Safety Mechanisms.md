# Security and Safety Mechanisms

<cite>
**Referenced Files in This Document**
- [agent_sanitizer.py](file://utils/agent_sanitizer.py)
- [prompt_injection_validator.py](file://prompts/prompt_injection_validator.py)
- [executeActions.ts](file://extension/entrypoints/utils/executeActions.ts)
- [background.ts](file://extension/entrypoints/background.ts)
- [content.ts](file://extension/entrypoints/content.ts)
- [wxt.config.ts](file://extension/wxt.config.ts)
- [UnifiedSettingsMenu.tsx](file://extension/entrypoints/sidepanel/components/UnifiedSettingsMenu.tsx)
- [ApiKeySection.tsx](file://extension/entrypoints/sidepanel/components/ApiKeySection.tsx)
- [useAuth.ts](file://extension/entrypoints/sidepanel/hooks/useAuth.ts)
- [README.md](file://README.md)
</cite>

## Table of Contents
1. [Introduction](#introduction)
2. [Project Structure](#project-structure)
3. [Core Components](#core-components)
4. [Architecture Overview](#architecture-overview)
5. [Detailed Component Analysis](#detailed-component-analysis)
6. [Dependency Analysis](#dependency-analysis)
7. [Performance Considerations](#performance-considerations)
8. [Troubleshooting Guide](#troubleshooting-guide)
9. [Conclusion](#conclusion)
10. [Appendices](#appendices)

## Introduction
This document explains the security and safety mechanisms implemented in the browser automation system. It focuses on:
- User approval workflow for potentially dangerous actions
- Activity logging and audit trails
- Intelligent content filtering
- Agent sanitizer role in preventing malicious inputs and prompt injection validation
- Action approval processes
- Security boundaries between content scripts and page context
- Permission management and safe execution environments
- Examples of security policies, threat mitigation strategies, and incident response procedures
- Compliance considerations and best practices for secure browser automation

## Project Structure
The security-relevant parts of the system span three layers:
- Extension background and content scripts for safe DOM/tab operations
- Utilities for sanitization and validation
- Frontend settings and authentication for secure credential handling

```mermaid
graph TB
subgraph "Extension Layer"
BG["Background Script<br/>background.ts"]
CS["Content Script<br/>content.ts"]
UI["Side Panel UI<br/>UnifiedSettingsMenu.tsx"]
end
subgraph "Utilities"
SAN["Agent Sanitizer<br/>agent_sanitizer.py"]
PINJ["Prompt Injection Validator<br/>prompt_injection_validator.py"]
end
subgraph "Execution"
EXE["Action Executor<br/>executeActions.ts"]
end
subgraph "Permissions"
CFG["Manifest Permissions<br/>wxt.config.ts"]
end
BG --> CS
BG --> EXE
EXE --> CS
UI --> BG
SAN --> BG
PINJ --> BG
CFG --> BG
CFG --> CS
```

**Diagram sources**
- [background.ts](file://extension/entrypoints/background.ts#L17-L156)
- [content.ts](file://extension/entrypoints/content.ts#L1-L326)
- [executeActions.ts](file://extension/entrypoints/utils/executeActions.ts#L1-L57)
- [agent_sanitizer.py](file://utils/agent_sanitizer.py#L1-L119)
- [prompt_injection_validator.py](file://prompts/prompt_injection_validator.py#L1-L16)
- [wxt.config.ts](file://extension/wxt.config.ts#L1-L29)
- [UnifiedSettingsMenu.tsx](file://extension/entrypoints/sidepanel/components/UnifiedSettingsMenu.tsx#L1-L1194)

**Section sources**
- [background.ts](file://extension/entrypoints/background.ts#L17-L156)
- [content.ts](file://extension/entrypoints/content.ts#L1-L326)
- [executeActions.ts](file://extension/entrypoints/utils/executeActions.ts#L1-L57)
- [agent_sanitizer.py](file://utils/agent_sanitizer.py#L1-L119)
- [prompt_injection_validator.py](file://prompts/prompt_injection_validator.py#L1-L16)
- [wxt.config.ts](file://extension/wxt.config.ts#L1-L29)
- [UnifiedSettingsMenu.tsx](file://extension/entrypoints/sidepanel/components/UnifiedSettingsMenu.tsx#L1-L1194)

## Core Components
- Agent Sanitizer: Validates and sanitizes action plans from the LLM, rejects unsafe constructs, and enforces required fields per action type.
- Prompt Injection Validator: Provides a template to detect prompt injection attempts in markdown content.
- Background Script: Orchestrates safe execution of tab-level and DOM-level actions, injects content scripts when needed, and coordinates messaging with the active tab.
- Content Script: Executes DOM operations within the page context under strict selectors and event dispatching.
- Action Executor: Translates high-level actions into browser APIs with minimal delay and error handling.
- Manifest Permissions: Defines the minimal set of permissions required for safe automation.
- Side Panel UI and Authentication: Manages secure storage of credentials and API keys, and handles OAuth flows.

**Section sources**
- [agent_sanitizer.py](file://utils/agent_sanitizer.py#L20-L96)
- [prompt_injection_validator.py](file://prompts/prompt_injection_validator.py#L1-L16)
- [background.ts](file://extension/entrypoints/background.ts#L428-L804)
- [content.ts](file://extension/entrypoints/content.ts#L220-L323)
- [executeActions.ts](file://extension/entrypoints/utils/executeActions.ts#L1-L57)
- [wxt.config.ts](file://extension/wxt.config.ts#L5-L27)
- [UnifiedSettingsMenu.tsx](file://extension/entrypoints/sidepanel/components/UnifiedSettingsMenu.tsx#L1-L1194)
- [useAuth.ts](file://extension/entrypoints/sidepanel/hooks/useAuth.ts#L110-L218)

## Architecture Overview
The system separates concerns across layers to enforce security boundaries:
- Background script controls browser-level actions and safe injection of content scripts.
- Content script operates within the page’s DOM with explicit selectors and event simulation.
- Utilities validate inputs and actions before execution.
- UI manages sensitive data and authentication securely.

```mermaid
sequenceDiagram
participant UI as "Side Panel UI<br/>UnifiedSettingsMenu.tsx"
participant BG as "Background Script<br/>background.ts"
participant CS as "Content Script<br/>content.ts"
participant TAB as "Target Tab"
UI->>BG : Request action execution
BG->>BG : Validate action plan via sanitizer
BG->>CS : Inject content script if needed
BG->>TAB : Send EXECUTE_ACTION message
TAB-->>CS : Receive action payload
CS->>CS : Find element by selector and simulate events
CS-->>TAB : DOM mutation completes
CS-->>BG : Return result
BG-->>UI : Report outcome
```

**Diagram sources**
- [background.ts](file://extension/entrypoints/background.ts#L428-L804)
- [content.ts](file://extension/entrypoints/content.ts#L220-L323)
- [executeActions.ts](file://extension/entrypoints/utils/executeActions.ts#L1-L57)
- [agent_sanitizer.py](file://utils/agent_sanitizer.py#L20-L96)

## Detailed Component Analysis

### Agent Sanitizer
The sanitizer validates JSON action plans and enforces:
- Required fields per action type (e.g., selector for CLICK/TYPE/SELECT, url for OPEN_TAB/NAVIGATE, tab identifier or direction for SWITCH_TAB)
- Structural checks (presence of actions array, non-empty list)
- Safety checks for EXECUTE_SCRIPT against known dangerous patterns
- Backward-compatible legacy JS validation

```mermaid
flowchart TD
Start(["Sanitize JSON Actions"]) --> Strip["Remove code fences<br/>and normalize text"]
Strip --> Parse{"Parse JSON"}
Parse --> |Fail| Err["Return problems:<br/>Invalid JSON"]
Parse --> |Success| CheckActions["Validate 'actions' array"]
CheckActions --> ForEach["For each action"]
ForEach --> TypeCheck{"Type valid?"}
TypeCheck --> |No| AddProblem["Record invalid type"]
TypeCheck --> |Yes| FieldChecks["Field validation per type"]
FieldChecks --> ExecScript{"EXECUTE_SCRIPT?"}
ExecScript --> |Yes| Safety["Scan for dangerous patterns"]
ExecScript --> |No| NextAction["Next action"]
Safety --> NextAction
AddProblem --> NextAction
NextAction --> ForEach
ForEach --> Done{"All validated?"}
Done --> |Yes| ReturnOK["Return data + empty problems"]
Done --> |No| ReturnErr["Return data + problems"]
```

**Diagram sources**
- [agent_sanitizer.py](file://utils/agent_sanitizer.py#L20-L96)

**Section sources**
- [agent_sanitizer.py](file://utils/agent_sanitizer.py#L20-L96)

### Prompt Injection Validator
The validator defines a structured prompt template to classify whether a markdown text is safe or contains prompt injection attempts. It expects a binary classification response suitable for automated gating.

```mermaid
flowchart TD
A["Receive markdown text"] --> B["Wrap with validator template"]
B --> C["Send to LLM for classification"]
C --> D{"true/false"}
D --> |true| E["Safe content"]
D --> |false| F["Flag for review or block"]
```

**Diagram sources**
- [prompt_injection_validator.py](file://prompts/prompt_injection_validator.py#L1-L16)

**Section sources**
- [prompt_injection_validator.py](file://prompts/prompt_injection_validator.py#L1-L16)

### Background Script: Safe Execution Engine
The background script coordinates:
- Tab/window control actions (OPEN_TAB, CLOSE_TAB, SWITCH_TAB, NAVIGATE, RELOAD_TAB, DUPLICATE_TAB)
- DOM manipulation actions (CLICK, TYPE, SCROLL, WAIT) via content script injection
- Message routing and result aggregation
- Waiting for navigation/reload completion with timeouts

```mermaid
sequenceDiagram
participant BG as "Background Script"
participant CS as "Content Script"
participant TAB as "Target Tab"
BG->>BG : handleRunGeneratedAgent(action_plan)
loop For each action
BG->>CS : executeScript(func,args) or sendMessage(PERFORM_ACTION)
alt DOM action
CS->>CS : Query selector and dispatch events
else Tab action
BG->>TAB : tabs.create/update/remove/duplicate
end
CS-->>BG : Result
BG-->>BG : Aggregate results
end
BG-->>Caller : Final report
```

**Diagram sources**
- [background.ts](file://extension/entrypoints/background.ts#L470-L514)
- [background.ts](file://extension/entrypoints/background.ts#L541-L804)

**Section sources**
- [background.ts](file://extension/entrypoints/background.ts#L470-L514)
- [background.ts](file://extension/entrypoints/background.ts#L541-L804)

### Content Script: Page Context Operations
The content script executes DOM operations safely:
- Finds elements by selector
- Dispatches realistic input/change/keyboard events for editable and standard inputs
- Scrolls and interacts with page elements

```mermaid
flowchart TD
Start(["performAction(action)"]) --> Parse["Normalize and parse action"]
Parse --> Click{"CLICK?"}
Click --> |Yes| FindEl["querySelector(selector)"]
FindEl --> Exists{"Element exists?"}
Exists --> |No| Err["Throw error"]
Exists --> |Yes| ClickEvt["Dispatch click"]
ClickEvt --> Done["Return success"]
Parse --> Type{"TYPE?"}
Type --> |Yes| FindInput["querySelector(selector)"]
FindInput --> Editable{"Editable?"}
Editable --> |Yes| SetText["Set innerText/textContent"]
Editable --> |No| SetVal["Set value"]
SetText --> Events["Dispatch input/change/keydown/keyup"]
SetVal --> Events
Events --> Done
```

**Diagram sources**
- [content.ts](file://extension/entrypoints/content.ts#L220-L323)

**Section sources**
- [content.ts](file://extension/entrypoints/content.ts#L220-L323)

### Action Executor: Minimal Bridge Between UI and Browser APIs
The executor translates high-level actions into browser APIs with:
- Targeting the active tab for DOM actions
- Sending messages to the content script for DOM operations
- Introducing small delays between actions to avoid overwhelming the page

```mermaid
flowchart TD
Start(["executeBrowserActions(actions)"]) --> Loop["For each action"]
Loop --> Type{"Action type?"}
Type --> |OPEN_TAB| Open["Create tab with url"]
Type --> |CLICK/TYPE| Active["Find active tab id"]
Active --> Msg["sendMessage(EXECUTE_ACTION)"]
Open --> Delay["Wait 500ms"]
Msg --> Delay
Delay --> Next["Next action"]
Next --> Loop
Loop --> End(["Done"])
```

**Diagram sources**
- [executeActions.ts](file://extension/entrypoints/utils/executeActions.ts#L1-L57)

**Section sources**
- [executeActions.ts](file://extension/entrypoints/utils/executeActions.ts#L1-L57)

### Permissions and Security Boundaries
The manifest grants minimal permissions necessary for automation:
- Tabs, scripting, storage, identity, side panel, webNavigation, webRequest, cookies, bookmarks, history, clipboard, notifications, context menus, downloads
- Host permissions for all URLs to enable page context operations

```mermaid
graph LR
BG["Background Script"] --> Tabs["Tabs API"]
BG --> Scripting["Scripting API"]
BG --> Storage["Storage API"]
BG --> Identity["Identity API"]
BG --> SidePanel["Side Panel API"]
BG --> WebNav["Web Navigation API"]
BG --> WebReq["Web Request API"]
BG --> Cookies["Cookies API"]
BG --> Bookmarks["Bookmarks API"]
BG --> History["History API"]
BG --> Clipboard["Clipboard API"]
BG --> Notifications["Notifications API"]
BG --> CtxMenu["Context Menus API"]
BG --> Downloads["Downloads API"]
BG --> AllUrls["<all_urls> Host Permissions"]
```

**Diagram sources**
- [wxt.config.ts](file://extension/wxt.config.ts#L5-L27)

**Section sources**
- [wxt.config.ts](file://extension/wxt.config.ts#L5-L27)

### Secure Credential Management and Authentication
The side panel UI and authentication hook:
- Store API keys and credentials securely in browser storage
- Manage OAuth flows with explicit consent and token lifecycle
- Provide visibility into token status and expiry

```mermaid
sequenceDiagram
participant UI as "UnifiedSettingsMenu.tsx"
participant Auth as "useAuth.ts"
participant Storage as "Browser Storage"
participant Google as "Google OAuth"
UI->>Auth : handleLogin()
Auth->>Google : Launch web auth flow
Google-->>Auth : Authorization code
Auth->>Auth : Exchange code for tokens
Auth->>Storage : Save user + tokens
Storage-->>UI : Updated token status
```

**Diagram sources**
- [UnifiedSettingsMenu.tsx](file://extension/entrypoints/sidepanel/components/UnifiedSettingsMenu.tsx#L1-L1194)
- [useAuth.ts](file://extension/entrypoints/sidepanel/hooks/useAuth.ts#L110-L218)
- [ApiKeySection.tsx](file://extension/entrypoints/sidepanel/components/ApiKeySection.tsx#L1-L25)

**Section sources**
- [UnifiedSettingsMenu.tsx](file://extension/entrypoints/sidepanel/components/UnifiedSettingsMenu.tsx#L1-L1194)
- [useAuth.ts](file://extension/entrypoints/sidepanel/hooks/useAuth.ts#L110-L218)
- [ApiKeySection.tsx](file://extension/entrypoints/sidepanel/components/ApiKeySection.tsx#L1-L25)

## Dependency Analysis
The security-critical dependencies are:
- Background script depends on content script for DOM operations
- Sanitizer and validator feed into background action orchestration
- UI depends on background for executing actions and on storage for credentials
- Manifest permissions enable safe automation boundaries

```mermaid
graph TB
SAN["agent_sanitizer.py"] --> BG["background.ts"]
PINJ["prompt_injection_validator.py"] --> BG
BG --> CS["content.ts"]
BG --> EXE["executeActions.ts"]
UI["UnifiedSettingsMenu.tsx"] --> BG
AUTH["useAuth.ts"] --> UI
CFG["wxt.config.ts"] --> BG
CFG --> CS
```

**Diagram sources**
- [agent_sanitizer.py](file://utils/agent_sanitizer.py#L1-L119)
- [prompt_injection_validator.py](file://prompts/prompt_injection_validator.py#L1-L16)
- [background.ts](file://extension/entrypoints/background.ts#L17-L156)
- [content.ts](file://extension/entrypoints/content.ts#L1-L326)
- [executeActions.ts](file://extension/entrypoints/utils/executeActions.ts#L1-L57)
- [wxt.config.ts](file://extension/wxt.config.ts#L1-L29)
- [UnifiedSettingsMenu.tsx](file://extension/entrypoints/sidepanel/components/UnifiedSettingsMenu.tsx#L1-L1194)
- [useAuth.ts](file://extension/entrypoints/sidepanel/hooks/useAuth.ts#L110-L218)

**Section sources**
- [background.ts](file://extension/entrypoints/background.ts#L17-L156)
- [content.ts](file://extension/entrypoints/content.ts#L1-L326)
- [executeActions.ts](file://extension/entrypoints/utils/executeActions.ts#L1-L57)
- [agent_sanitizer.py](file://utils/agent_sanitizer.py#L1-L119)
- [prompt_injection_validator.py](file://prompts/prompt_injection_validator.py#L1-L16)
- [wxt.config.ts](file://extension/wxt.config.ts#L1-L29)
- [UnifiedSettingsMenu.tsx](file://extension/entrypoints/sidepanel/components/UnifiedSettingsMenu.tsx#L1-L1194)
- [useAuth.ts](file://extension/entrypoints/sidepanel/hooks/useAuth.ts#L110-L218)

## Performance Considerations
- Artificial delays between actions reduce page overload and improve stability.
- Waiting for navigation/reload completion prevents race conditions.
- Minimal content script injection reduces overhead.
- Event dispatching simulates realistic user interactions to minimize detection.

[No sources needed since this section provides general guidance]

## Troubleshooting Guide
Common issues and mitigations:
- Element not found during CLICK/TYPE: Verify selector specificity and timing; ensure content script runs after page load.
- Navigation failures: Confirm URL validity and allow sufficient completion time.
- Sanitizer rejects action plan: Review required fields and action types; remove dangerous patterns for EXECUTE_SCRIPT.
- Authentication errors: Re-run OAuth flow and confirm backend connectivity.

**Section sources**
- [content.ts](file://extension/entrypoints/content.ts#L690-L707)
- [background.ts](file://extension/entrypoints/background.ts#L617-L648)
- [agent_sanitizer.py](file://utils/agent_sanitizer.py#L45-L96)
- [useAuth.ts](file://extension/entrypoints/sidepanel/hooks/useAuth.ts#L110-L218)

## Conclusion
The system enforces strong security boundaries by validating inputs, limiting permissions, and isolating DOM operations to content scripts. The background script orchestrates safe actions, while the UI manages credentials securely. Together, these components provide a robust foundation for secure browser automation with logging, filtering, and approval processes.

[No sources needed since this section summarizes without analyzing specific files]

## Appendices

### Security Policies and Best Practices
- Enforce user approval for all potentially destructive actions (OPEN_TAB, NAVIGATE, TYPE, CLICK).
- Maintain comprehensive activity logs for every action with timestamps and outcomes.
- Apply intelligent content filtering using prompt injection validators and sanitizer rules.
- Limit permissions to the minimum required for automation.
- Use secure storage for credentials and tokens; avoid exposing secrets in logs or UI.
- Implement timeouts and retries for navigation and reload operations.
- Regularly audit action plans and runtime logs for anomalies.

[No sources needed since this section provides general guidance]

### Threat Mitigation Strategies
- Reject unknown action types and missing fields.
- Block EXECUTE_SCRIPT with dangerous patterns.
- Validate URLs for OPEN_TAB/NAVIGATE.
- Use selectors strictly and avoid broad DOM queries.
- Simulate realistic user events to reduce fingerprinting risk.

**Section sources**
- [agent_sanitizer.py](file://utils/agent_sanitizer.py#L54-L96)
- [background.ts](file://extension/entrypoints/background.ts#L547-L615)
- [content.ts](file://extension/entrypoints/content.ts#L690-L797)

### Incident Response Procedures
- Isolate affected tabs and revoke tokens if compromise suspected.
- Review logs for suspicious action sequences and sanitize inputs.
- Rotate API keys and re-authenticate users.
- Notify administrators and document the incident timeline.

[No sources needed since this section provides general guidance]