# Database design

PostgreSQL via SQLModel. UUID primary keys, timezone-aware UTC timestamps, JSONB for LLM blobs. Models are imported in `app/db/base.py` so Alembic autogenerate sees them. Apply with `uv run alembic upgrade head` from `backend/`.

Revisions: `0001_initial`, `0002_hiring_command_center_teams_`, `0003_organization_governance`.

```mermaid
erDiagram
  User ||--o{ Membership : has
  Organization ||--o{ Membership : has
  User ||--o{ AuthAccount : has
  Organization ||--o{ JobDescription : owns
  Organization ||--o{ Candidate : owns
  JobDescription ||--o{ JDRequirement : has
  JobDescription ||--o| JDExtraction : has
  Candidate ||--o{ Resume : has
  Resume ||--o{ ResumeAIAnalysis : has
  JobDescription ||--o{ CandidateControlMatrix : scores
  Candidate ||--o{ CandidateControlMatrix : scores
  JobDescription ||--o{ JDResumeMatchEvaluation : eval
  Candidate ||--o{ ValidationSignal : signals
  JobDescription ||--o{ RecruiterReport : reports
  Organization ||--o{ Team : has
  Team ||--o{ TeamMembership : members
  JobDescription ||--o{ Application : pipeline
  JobDescription ||--o{ Interview : schedule
```

## User and org (`app/db/models/user.py`)

| Table | Class | Notes |
|---|---|---|
| `users` | `User` | email unique, `password_hash`, `UserStatus` |
| `organizations` | `Organization` | `slug` unique, `OrganizationStatus` |
| `memberships` | `Membership` | unique `(user_id, organization_id)`, `OrganizationRole` |
| `auth_accounts` | `AuthAccount` | `AuthProvider` google / email |
| `magic_links` | `MagicLink` | hashed token, TTL, optional pending password |
| `platform_role_assignments` | `PlatformRoleAssignment` | `app_admin` |
| `organization_domains` | `OrganizationDomain` | domain verify, default role |
| `organization_invitations` | `OrganizationInvitation` | email invite, expiry |
| `invitation_team_assignments` | `InvitationTeamAssignment` | invite → team + `TeamRole` |
| `team_memberships` | `TeamMembership` | unique `(team_id, user_id)` |
| `audit_events` | `AuditEvent` | actor, action, JSON metadata |

Org roles: `admin`, `recruiter`, `viewer`. Team roles: `team_admin`, `team_recruiter`, `interviewer`, `team_viewer`.

## Recruitment (`app/db/models/recruitment.py`)

| Table | Class | Notes |
|---|---|---|
| `candidates` | `Candidate` | profile URLs for GitHub, LinkedIn, LeetCode, Codeforces |
| `resumes` | `Resume` | `raw_text`, `structured_json` |
| `resume_analyses` | `ResumeAnalysis` | older analysis row |
| `job_descriptions` | `JobDescription` | posting status plus command-center fields |
| `jd_requirements` | `JDRequirement` | `control_id`, `must_have`, tags |
| `hiring_campaigns` | `HiringCampaign` | |
| `campaign_drives` | `CampaignDrive` | |
| `validation_signals` | `ValidationSignal` | one observation per source/claim |
| `candidate_control_matrix` | `CandidateControlMatrix` | unique per org/JD/candidate/requirement |
| `candidate_score_snapshots` | `CandidateScoreSnapshot` | five-factor snapshot |
| `recruiter_reports` | `RecruiterReport` | structured report |
| `gap_alignment_analysis` | `GapAlignmentAnalysis` | |
| `final_candidates_report` | `FinalCandidateReport` | markdown |
| `teams` | `Team` | unique `(organization_id, name)` |
| `applications` | `Application` | `PipelineStage` |
| `interviews` | `Interview` | `InterviewStatus`, optional `meet_link` |

`JobDescriptionStatus`: draft, active, closed. `RequestStatus` (same table): open, in_review, interviewing, offer, filled, on_hold, closed. `PipelineStage`: applied, screen, interview, offer, hired, rejected.

## JD AI (`jd_ai.py`)

`JDExtraction` (`jd_extractions`): one row per JD (`job_description_id` unique). Skill lists and experience bounds as JSONB / floats, plus `raw_llm_response`.

## Resume AI (`resume_ai.py`)

`ResumeAIAnalysis` (`resume_ai_analyses`): unique `(organization_id, resume_id, job_description_id)`. Full section JSONB from Gemini.

## Match evaluation (`match_evaluation.py`)

`JDResumeMatchEvaluation`: unique `(organization_id, job_description_id, candidate_id)`. Seven dimension scores and justifications.

`CandidateWeightedRanking`: unique same triple, `weights_used`, `weighted_breakdown`, `final_score`, `rank_position`.

## Connection

Local Compose:

```
postgresql+psycopg://postgres:postgres@localhost:5432/talentsync_hr
```

Docker worker uses host `talentsync_hr_db` instead of `localhost`.
