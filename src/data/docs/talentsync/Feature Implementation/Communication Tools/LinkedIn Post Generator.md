# LinkedIn post generator

## Introduction
The LinkedIn Post Generator is an AI-powered system designed to streamline professional social media content creation on LinkedIn. It enables users to generate multiple, high-quality posts tailored to specific topics, tones, audiences, and lengths. The system integrates optional research enhancements, GitHub project insights, and content personalization to produce authentic, brand-consistent posts optimized for engagement.

Key capabilities include:
- AI-driven post generation with customizable tone, length, emoji level, and hashtag suggestions
- Optional web research to enrich posts with current industry insights
- GitHub project integration to surface technical achievements and hooks
- Frontend interface for configuring generation parameters and reviewing outputs
- Optional post editing using AI instructions

## Project structure
The system spans backend services and frontend UI:
- Backend exposes FastAPI routes for LinkedIn post generation and page composition
- Services orchestrate LLM calls, optional agent integrations, and data shaping
- Agents provide web research and GitHub project analysis
- Frontend offers a user-friendly form and results display

```mermaid
graph TB
subgraph "Frontend"
UI["LinkedIn Posts UI<br/>page.tsx"]
SVC["Frontend Service<br/>linkedin.service.ts"]
end
subgraph "Backend"
ROUTER["Routes<br/>linkedin.py"]
POST_SVC["Post Service<br/>linkedin_post.py"]
PROFILE_SVC["Profile Service<br/>linkedin_profile.py"]
WEB_AGENT["Web Search Agent<br/>websearch_agent.py"]
GH_AGENT["GitHub Agent<br/>github_agent.py"]
end
UI --> SVC
SVC --> ROUTER
ROUTER --> POST_SVC
ROUTER --> PROFILE_SVC
POST_SVC --> WEB_AGENT
POST_SVC --> GH_AGENT
PROFILE_SVC --> WEB_AGENT
PROFILE_SVC --> GH_AGENT
```

## Core components
- Routes: Define endpoints for generating posts, editing posts, and generating a complete LinkedIn page
- Post Service: Orchestrates LLM invocation, optional research, GitHub context, cleaning, and post structuring
- Profile Service: Generates headline, summary, about section, experience highlights, skills, and suggested posts for a full LinkedIn presence
- Agents: WebSearchAgent for topic research and GitHubAgent for project insights
- Frontend UI: Provides a form to configure generation parameters and displays results with copy/download actions

## Architecture overview
The system follows a layered architecture:
- Presentation Layer: Next.js UI with form controls and result rendering
- API Layer: FastAPI routes exposing generation endpoints
- Service Layer: Business logic for post generation and profile composition
- Agent Layer: Optional external integrations for research and GitHub insights
- LLM Integration: Asynchronous LLM invocations for content generation and summarization

```mermaid
sequenceDiagram
participant Client as "Frontend UI"
participant API as "FastAPI Router"
participant PostSvc as "Post Service"
participant Web as "WebSearchAgent"
participant GH as "GitHubAgent"
participant LLM as "LLM"
Client->>API : POST /linkedin/generate-posts
API->>PostSvc : generate_linkedin_posts_service(request, llm)
alt Agents Available
PostSvc->>Web : research_topic_with_web(topic)
Web->>LLM : summarize_research(...)
LLM-->>Web : research_summary
PostSvc->>GH : scrape_github_project_info(url)
GH-->>PostSvc : project insights
end
loop For each post
PostSvc->>LLM : generate_single_post(prompt)
LLM-->>PostSvc : post text
PostSvc->>LLM : suggest hashtags (optional)
LLM-->>PostSvc : hashtags
PostSvc->>LLM : suggest CTA (optional)
LLM-->>PostSvc : CTA
end
PostSvc-->>API : PostGenerationResponse
API-->>Client : JSON response
```

## Detailed component analysis

### Post generation workflow
The core workflow generates one or more posts based on user-provided parameters, optional research, and GitHub context. It cleans LLM output, optionally suggests hashtags and CTAs, and structures the response.

```mermaid
flowchart TD
Start(["Start"]) --> Validate["Validate Request<br/>topic required"]
Validate --> Research{"Agents Available<br/>and Research Enabled?"}
Research --> |Yes| WebResearch["Web Research<br/>research_topic_with_web"]
Research --> |No| NoResearch["Skip Research"]
WebResearch --> BuildContext["Build Enhanced Context<br/>GitHub + Research"]
NoResearch --> BuildContext
BuildContext --> LoopPosts{"Loop for Post Count"}
LoopPosts --> Prompt["Compose Prompt<br/>tone, audience, length,<br/>emoji level, context"]
Prompt --> CallLLM["Call LLM<br/>generate_single_post"]
CallLLM --> Clean["Clean Output<br/>remove prefixes, quotes"]
Clean --> Hashtags{"Hashtags Option?"}
Hashtags --> |Suggest| SuggestTags["LLM Suggest Hashtags"]
Hashtags --> |None| SkipTags["Skip Hashtags"]
SuggestTags --> CTA{"CTA Provided?"}
SkipTags --> CTA
CTA --> |No| AutoCTA["LLM Suggest CTA"]
CTA --> |Yes| KeepCTA["Use Provided CTA"]
AutoCTA --> BuildPost["Build GeneratedPost"]
KeepCTA --> BuildPost
BuildPost --> Collect["Collect Post"]
Collect --> LoopPosts
LoopPosts --> Done(["Return PostGenerationResponse"])
```

### Personalization strategies
Personalization is achieved through:
- Tone and audience parameters shaping the LLM prompt
- Optional mimic examples to align style with user preferences
- GitHub project context to tailor posts to technical achievements
- Optional web research to ground posts in current industry insights
- Emoji level control for personality and engagement balance

These inputs are mapped into prompt guidance and passed to the LLM for content generation.

### Content formatting and engagement features
- Hashtag suggestions: Optional LLM-generated hashtags when enabled
- Call-to-action suggestions: Optional LLM-generated CTAs or user-provided
- Sources: Research results included when available
- GitHub project name: Derived from context for attribution
- Frontend formatting: Displays posts with hashtags and optional sources; supports copying and downloading

### Tone and style customization
- Tone: Selectable from predefined options (e.g., Professional, Conversational, Inspirational, Analytical, Friendly)
- Length: Short, Medium, Long, Any
- Emoji level: Integer scale controlling emoji usage
- Language: Optional field for localization
- Mimic examples: Optional pasted post to emulate style

These parameters are embedded into the generation prompt to steer the LLM's output.

### Integration with user profiles and network insights
- Profile Composition: The profile service composes headline, summary, about section, experience highlights, and skills based on user input and optional GitHub insights
- Content Calendar: Suggests weekly posting themes and goals
- Engagement Tips: Personalized advice based on experience, GitHub presence, and industry
- Optional GitHub Integration: Analyzes repositories for LinkedIn-friendly hooks and hashtags

### Content planning and scheduling
- Weekly Themes: Industry insights, career growth, technology trends, and project highlights
- Bi-weekly and Monthly Ideas: Industry commentary and milestone reflections
- Hashtag Suggestions: Tailored to content type and industry
- Engagement Goals: Drive discussions, position as thought leader, connect and inspire

### Example templates and engagement strategies
- Achievement Announcement Template: Hook with project name, impact statement, and optional CTA
- Industry Insight Template: Trend summary with a professional hook and 2–3 relevant hashtags
- Networking Template: Personal anecdote or reflection with a subtle CTA to connect

Engagement strategies:
- Consistent posting cadence (2–3 times per week)
- Mix of insights, personal experiences, and behind-the-scenes content
- Authentic engagement with thoughtful responses
- Strategic hashtag usage (3–5 per post)
- Use of stories/live and long-form articles for deeper reach

[No sources needed since this section provides general guidance]

### Content authenticity, brand consistency, and professional presentation
- Authenticity: LLM output is cleaned to remove explanatory text and meta-commentary; prompts emphasize "authentic, valuable" content
- Brand Consistency: Tone and audience parameters keep messaging aligned with user-defined style and target
- Professional Presentation: Structured prompts, optional research grounding, and optional GitHub context ensure polished, credible posts

## Dependency analysis
The backend components depend on:
- LangChain LLM clients for asynchronous content generation
- Optional agents for research and GitHub analysis
- Pydantic models for request/response validation
- FastAPI for routing and dependency injection

```mermaid
graph LR
ROUTER["routes/linkedin.py"] --> POST_SVC["services/linkedin_post.py"]
ROUTER --> PROFILE_SVC["services/linkedin_profile.py"]
POST_SVC --> WEB_AGENT["agents/websearch_agent.py"]
POST_SVC --> GH_AGENT["agents/github_agent.py"]
PROFILE_SVC --> WEB_AGENT
PROFILE_SVC --> GH_AGENT
FRONT_UI["frontend/page.tsx"] --> FRONT_SVC["frontend/linkedin.service.ts"]
FRONT_SVC --> ROUTER
```

## Performance considerations
- Asynchronous LLM calls minimize latency during generation
- Optional research and GitHub analysis are gated by flags to reduce overhead when not needed
- Output cleaning avoids unnecessary post-processing
- Frontend debounces and disables generation when required fields are missing

[No sources needed since this section provides general guidance]

## Troubleshooting guide
Common issues and resolutions:
- Missing TAVILY API key: Web research will log warnings and return empty results; disable research or configure the key
- Invalid GitHub URL: Project analysis returns an error; ensure a valid GitHub repository URL
- Empty topic: Frontend prevents generation until a topic is provided
- LLM unavailability: Research summaries fall back to raw content extraction; post generation may still succeed depending on prompt structure

## Conclusion
The LinkedIn Post Generator delivers a reliable, extensible solution for AI-assisted LinkedIn content creation. By combining configurable prompts, optional research and GitHub insights, and a clean frontend interface, it empowers professionals to craft authentic, engaging, and brand-consistent posts efficiently. The modular architecture supports incremental enhancements, such as scheduling, advanced personalization, and expanded agent integrations.

[No sources needed since this section summarizes without analyzing specific files]

## Appendices

### API endpoints overview
- POST /linkedin/generate-posts: Generate multiple posts based on parameters
- POST /linkedin/edit-post: Edit an existing post with AI instructions
- POST /linkedin/generate-page: Generate a complete LinkedIn page including profile and suggested posts

### Data models summary
- PostGenerationRequest: Topic, tone, audience, length, hashtags option, CTA, mimic examples, language, post count, emoji level, GitHub URL, research toggle
- GeneratedPost: Text, hashtags, CTA suggestion, token info, sources, GitHub project name
- PostGenerationResponse: Success flag, message, list of posts, timestamp
