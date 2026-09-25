# Introduction and problem statement

TalentSync is for people applying to jobs, not for HR teams screening a pile. ATS filters still drop qualified resumes over formatting and missing keywords. Rewriting a resume per posting by hand is slow and you get no signal.

Live: https://talentsync.tashif.codes/

TalentSync-HR is a different product. Employer dashboards and bulk recruiter ingest belong there.

## Problem statement

Job seekers write into a black box. Parsers want a shape humans do not write. Feedback is generic. Each application wants a slightly different document.

The old README quotes 49 applications per job and 93% ATS adoption as recruiter pain. This codebase spends its routes on the seeker side of that mess: parse, score, rewrite, draft outreach, practice interviews.

### Pain on the seeker side

- ATS rejection for formatting or keyword layout, not skill.
- Vague "we went another direction" with nothing to change.
- Manual tailoring per posting.
- No score that says why this resume missed that JD.

### What this app does

- Resume analysis with structured extraction (PyMuPDF, LLM).
- ATS evaluation against a job description.
- Tailored resume, JD editor, AI editor, enrichment, Unslop.
- Cover letters, cold mail, LinkedIn drafts.
- Interview sessions and a career coach.
- Metered plans (Razorpay). Free/paid caps live in `frontend/lib/plans.ts` and `backend/app/services/metering.py`. Core tools are not "unlimited free" in the current metering code.

### What it does not do

- Rank a company's inbound applicants.
- Replace an ATS for employers.
- Ship recruiter bulk ZIP screening as the headline feature.

### Technical foundation

LangChain / LangGraph for generation. FastAPI enqueues metered AI to Kafka. Workers write results to `talentsync_backend.job`. Next.js is the UI and BFF. Google OAuth is the default login.

The scikit-learn pickle under `analysis/` is a leftover classifier. Production analysis does not go through that notebook.

### How a request lands

1. Browser hits a Next.js route.
2. BFF authenticates via backend JWT cookies and forwards to FastAPI.
3. `feature_gate` charges, then `submit_job` inserts a row and publishes a thin envelope.
4. Worker runs the existing service function.
5. Client waits on `job_id` (poll or SSE).

Token streams skip that queue on purpose.
