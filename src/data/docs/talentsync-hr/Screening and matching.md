# Screening and matching

End-to-end path for one candidate against one JD. HTTP creates the records and publishes Kafka. `PipelineOrchestrator.run_post_parse_pipeline` (from `on_resume_processed`) does the slow work.

```mermaid
flowchart TD
  JDIn["POST /jds /upload /url"]
  JDExt["JDExtractionService<br/>skills_extractions_from_jd"]
  JDRow["JDExtraction + JDRequirement"]
  ResIn["POST /resumes/upload<br/>or POST /jds/public/{jd_id}/apply"]
  ResExt["ResumeExtractionService<br/>skill_extraction_from_resume"]
  ResRow["Resume + ResumeAIAnalysis"]
  Kafka["talentsync-resume-processed"]
  P1["Phase 1 parallel"]
  Match["MatchingService.evaluate<br/>JDResumeMatchEvaluation"]
  Val["ValidationService<br/>GitHub LeetCode Codeforces LinkedIn"]
  P2["Phase 2 matrix"]
  Matrix["CandidateControlMatrix<br/>per JDRequirement"]
  P3["Phase 3 ranking"]
  Snap["CandidateScoreSnapshot"]
  P4["Phase 4 gap"]
  Gap["GapAlignmentAnalysis"]
  P5["Phase 5 report"]
  Rep["RecruiterReport + FinalCandidateReport"]

  JDIn --> JDExt --> JDRow
  ResIn --> ResExt --> ResRow
  ResRow --> Kafka
  JDRow --> Kafka
  Kafka --> P1
  P1 --> Match
  P1 --> Val
  Match --> P2
  Val --> P2
  P2 --> Matrix
  Matrix --> P3 --> Snap
  Snap --> P4 --> Gap
  Gap --> P5 --> Rep
```

## JD extract

`jd_extraction_service.py` plus prompt `app/data/prompt/skills_extractions_from_jd.py`. Writes `jd_extractions`: title, type, department, skill lists, experience bounds, `raw_llm_response`. Also inserts `jd_requirements` with `control_id`, `must_have`, `priority_weight`. Then `publish_jd_created` (`talentsync-jd-created`). The extraction handler currently logs only.

## Resume extract

`resume_extraction_service.py` plus `skill_extraction_from_resume.py`. Writes contact fields, `predicted_field`, `recommended_roles`, JSONB sections (skills, education, work, projects, publications, PoR, certs, achievements). `publish_resume_extracted`. If the resume is tied to a JD, `publish_resume_processed`.

## Match

`MatchingService.evaluate` runs the holistic prompt `matching_of_jd_and_resume.py` (education, experience, skills, projects, certs, achievements, gap). `match_requirement` fills one matrix row: `matched` / `partial` / `unmatched`, evidence JSON, scores. Worker blends LLM confidence 0.7 with validation score 0.3.

You can also trigger HTTP `POST /matches/run` and `POST /match-evaluation/run` without waiting for Kafka.

## External validation

`claim_extractor.py` pulls project and work claims from resume JSON. Adapters:

| Source | Adapter | Config |
|---|---|---|
| GitHub | `github_adapter.py` | optional `GITHUB_TOKEN`, `GITHUB_STATS_API_BASE_URL` |
| LinkedIn | `linkedin_adapter.py` | Proxycurl `PROXYCURL_API_KEY` |
| LeetCode | `leetcode_adapter.py` | `LEETCODE_STATS_API_BASE_URL` |
| Codeforces | `codeforces_adapter.py` | `CODEFORCES_STATS_API_BASE_URL` |

Each observation becomes a `ValidationSignal` (`source`, `claim`, `evidence_url`, `matched`, `confidence_delta`). Missing URLs skip that adapter. Timeout 8s.

## Ranking

Pipeline snapshot weights: jd_match 0.50, projects 0.20, coding_profiles 0.15, education 0.10, experience 0.05. Coding profile is a coarse bump if `candidate.github_url` is set (70 vs 40).

`GET /rankings/{jd_id}` uses `RankingService` on the seven holistic dimensions (weights must sum to 1.0) and stores `CandidateWeightedRanking`.

## Report

`GapAlignmentAnalysisService` then `ReportService` (summary, strengths, risks, interview focus, recommendation) then `FinalCandidateReportService` (markdown dossier). Orchestrator publishes `talentsync-report-generated`.

```mermaid
sequenceDiagram
  participant Rec as Recruiter UI
  participant API as FastAPI
  participant K as Kafka
  participant W as PipelineOrchestrator
  participant G as Gemini
  participant X as Profile APIs
  participant DB as Postgres

  Rec->>API: create JD + upload resume
  API->>G: extract JD / resume
  API->>DB: JDExtraction, ResumeAIAnalysis
  API->>K: talentsync-resume-processed
  K->>W: on_resume_processed
  par Phase 1
    W->>G: MatchingService.evaluate
    W->>X: ValidationService adapters
  end
  W->>G: per-requirement matrix
  W->>DB: CandidateControlMatrix, scores
  W->>G: gap + reports
  W->>DB: RecruiterReport
  Rec->>API: GET /reports/{jd_id}/{candidate_id}
```

Frontend: `/jobs/{jobId}/candidates/{candidateId}/report` and hooks `use-report`, `use-validation`, `use-match-evaluation`, `use-gap-alignment`.
