# Agentic browser documentation index

Welcome to the **Agentic Browser** detailed documentation. This page is the unified index for all documentation, consolidating content from both the new topical organization and the detailed numbered guides.

## Quick navigation

### Core documentation
- **[Project Overview](Project%20Overview.md)** - System architecture, core components, and capabilities
- **[Getting Started](Getting%20Started.md)** - Installation, setup, and quick start guide

### System components

#### Backend architecture
- **[API Server](API%20Server)** - FastAPI router-service-tool architecture
  - API endpoints and route definitions
  - Service layer business logic
  - Tool layer for external integrations

#### Agent system
- **[AI Agent System](AI%20Agent%20System)** - LangGraph-based agent orchestration
  - React agent for conversational AI
  - Browser Use agent for script generation
  - Tool system and orchestration
  - Context management and state handling

#### Browser extension
- **[Browser Extension](Browser%20Extension)** - WebExtensions-based UI and automation
  - Extension architecture and messaging
  - Background and content scripts
  - Side panel UI components
  - Agent execution engine
  - WebSocket communication
  - Authentication system

#### MCP server
- **[MCP Server](MCP%20Server.md)** - Model Context Protocol implementation
  - Tool definitions and standardization
  - LLM integration through MCP
  - Integration with external clients

### Features & integrations

#### Service integrations
- **[Service Integrations](Service%20Integrations)** - External service connectivity
  - Gmail integration for email operations
  - Google Calendar integration for scheduling
  - GitHub integration for repository analysis
  - YouTube integration for video processing
  - Website analysis and content extraction
  - Academic portal integration

#### Data & models
- **[Data Models and Schemas](Data%20Models%20and%20Schemas)** - API contracts and schemas
  - Request and response models
  - Service integration data structures
  - Agent communication formats
  - Validation and error handling

### Configuration & operations
- **[Configuration Management](Configuration%20Management.md)** - Environment setup and configuration
- **[Deployment and Operations](Deployment%20and%20Operations.md)** - Production deployment
- **[Development Guidelines](Development%20Guidelines.md)** - Contribution and development practices
- **[Testing Strategy](Testing%20Strategy.md)** - Testing approach and utilities

### Reference
- **[System Architecture](System%20Architecture)** - Detailed system design
- **[Tool System](Tool%20System)** - Tool definitions and framework
- **[Prompts and Prompt Engineering](Prompts%20and%20Prompt%20Engineering)** - LLM prompt strategies
- **[Security Considerations](Security%20Considerations.md)** - Security best practices
- **[Troubleshooting and FAQ](Troubleshooting%20and%20FAQ.md)** - Common issues and solutions

---

## Documentation structure

This consolidated documentation is organized into two parallel structures:

### Topical organization (primary)
The documentation is primarily organized by topic/component, making it easy to find information about specific features:
- Overview and getting started materials at the top level
- Component-specific sections in dedicated folders
- Detailed guides and reference material within each component

### Historical reference (numbered sections)
The original numbered documentation structure is preserved for reference:
- **Section 1**: Overview and system architecture
- **Section 2**: Installation and getting started
- **Section 3**: Python backend API
- **Section 4**: Agent intelligence system
- **Section 5**: Browser extension
- **Section 6**: Data models and API contracts

Both structures provide the same information, choose whichever navigation style works best for you.

---

## Getting started paths

### For first-time users
1. Start with **[Project Overview](Project%20Overview.md)** to understand the system
2. Follow **[Getting Started](Getting%20Started.md)** for installation and setup
3. Explore **[System Architecture](System%20Architecture)** to understand how components interact

### For developers
1. Review **[Development Guidelines](Development%20Guidelines.md)** for contribution process
2. Study relevant component documentation:
   - Backend: **[API Server](API%20Server)** and **[AI Agent System](AI%20Agent%20System)**
   - Frontend: **[Browser Extension](Browser%20Extension)**
3. Reference **[Data Models and Schemas](Data%20Models%20and%20Schemas)** for API contracts

### For operators
1. Read **[Configuration Management](Configuration%20Management.md)** to set up your environment
2. Review **[Deployment and Operations](Deployment%20and%20Operations.md)** for production setup
3. Use **[Troubleshooting and FAQ](Troubleshooting%20and%20FAQ.md)** for common issues

### For integration
1. Review **[MCP Server](MCP%20Server.md)** for protocol-level integration
2. Study **[Service Integrations](Service%20Integrations)** for available features
3. Check **[Data Models and Schemas](Data%20Models%20and%20Schemas)** for API contracts

---

## Key concepts

### Model-Agnostic design
The system supports multiple LLM providers (Google Gemini, OpenAI, Anthropic, Ollama, DeepSeek, OpenRouter) through a unified abstraction layer. Users supply their own API keys via environment variables (BYOK - Bring Your Own Keys).

### Layered architecture
- **Frontend**: Browser extension with background and content scripts
- **Backend**: FastAPI server with service-oriented architecture
- **Agent Runtime**: LangGraph-based agent orchestration
- **LLM Layer**: Model-agnostic provider adapters
- **Safety Layer**: Guardrails, logging, and user consent

### Tool system
The system provides 11+ specialized tools for web automation, content processing, and external service integration. Tools are dynamically constructed based on context and user authentication.

### Declarative action system
Browser automation is achieved through JSON-based action plans generated by the LLM, ensuring safety and transparency in automated actions.

---

## Technology stack

- **Language**: Python 3.12+ (backend), TypeScript/React (frontend)
- **Agent Framework**: LangChain, LangGraph
- **Web Framework**: FastAPI, Uvicorn
- **Extension Framework**: WXT (Web eXtension Tooling)
- **Browser APIs**: WebExtensions API
- **Communication**: MCP (Model Context Protocol), WebSocket, HTTP/REST
- **Content Processing**: BeautifulSoup, html2text, yt-dlp
- **Security**: python-dotenv, pycryptodome

---

## Common tasks

### Setting up the development environment
See: [Getting Started](Getting%20Started.md#installation) and [Development Guidelines](Development%20Guidelines.md)

### Configuring API keys and environment
See: [Configuration Management](Configuration%20Management.md)

### Adding a new service integration
See: [Service Integrations](Service%20Integrations) and [Development Guidelines](Development%20Guidelines.md)

### Understanding agent behavior
See: [AI Agent System](AI%20Agent%20System) and [Prompts and Prompt Engineering](Prompts%20and%20Prompt%20Engineering)

### Debugging and troubleshooting
See: [Troubleshooting and FAQ](Troubleshooting%20and%20FAQ.md) and [System Architecture](System%20Architecture)

### Deploying to production
See: [Deployment and Operations](Deployment%20and%20Operations.md)

### Integrating with external tools
See: [MCP Server](MCP%20Server.md) and [Data Models and Schemas](Data%20Models%20and%20Schemas)

---

## Contributing

Before contributing, please review:
1. **[Development Guidelines](Development%20Guidelines.md)** - Contribution process and standards
2. **[Testing Strategy](Testing%20Strategy.md)** - Testing requirements
3. **[Security Considerations](Security%20Considerations.md)** - Security best practices

---

## Version history

This consolidated documentation combines:
- **New Documentation**: Topical organization with component-based structure
- **Previous Documentation**: Detailed numbered guides with implementation specifics

Both sources have been merged to provide detailed coverage of all aspects of the Agentic Browser system.

---

## Additional resources

- **GitHub Repository**: https://github.com/tashifkhan/agentic-browser
- **Issue Tracker**: https://github.com/tashifkhan/agentic-browser/issues
- **Discussions**: https://github.com/tashifkhan/agentic-browser/discussions

---

*Last Updated: 2026*
*Documentation Status: Consolidated and Unified*
