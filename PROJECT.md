# PTM AI Agent — Project Overview

## What it is
Internal automation for **Sheldon Labs** that replaces the 8–9 page manual Parent-Teacher Meeting report with a **1-page AI-generated report**, gated by teacher approval, then delivered to parents via email (and a mocked WhatsApp channel).

## Goal
Cut teacher prep time, standardise PTM output, surface confidence/evidence so teachers can correct what the model got wrong, and remove the human bottleneck without removing the human reviewer.

## Stack (current)
| Layer | Tech |
|---|---|
| Frontend | Next.js 16 (App Router, Turbopack) · React 19 · Tailwind v4 · framer-motion · lucide-react |
| Backend | FastAPI · Python 3.12 · `asyncpg` · `aiosmtplib` · `httpx` · `playwright` · `gtts` |
| LLM | **Azure OpenAI GPT-5.1** (`AZURE_OPENAI_*` env vars). Falls back to deterministic mock when no key. |
| TTS | **gTTS** (Google Translate, free). ElevenLabs was removed — Render's shared egress IPs trip ElevenLabs' free-tier abuse heuristic. |
| DB | **PostgreSQL** (Supabase pooler in prod, `asyncpg` driver). Migrations in `backend/db/migrations/*.sql`, applied on startup. |
| Storage | **Supabase Storage** — `pdfs` and `audio` public buckets. |
| Email | **Gmail SMTP** via `aiosmtplib` (`support@supersheldon.com`). Per-approve custom recipient option in the UI replaces the old env-var redirect — teachers can route any single approval to a test inbox without affecting other sends. |
| WhatsApp | Mocked — row written to `ptm_delivery_log`, no real send. |
| Wise (student data) | MongoDB (`motor`) — same DB used by the presales CRM. Mock data when `MONGO_CONNECTION_STRING` unset. |
| Deploy | Backend on **Render** (`supersheldon-ptm.onrender.com`). Frontend on Vercel (any `*.vercel.app`). |

## Repo layout
```
PTM-Report-Generator/
├── app/                              Next.js frontend
│   └── app/
│       ├── page.tsx                  marketing landing
│       ├── login/page.tsx            email-link auth gate
│       ├── components/               shared UI (~30 components — see below)
│       ├── lib/                      api.ts, mock-data.ts, auth.ts, risk.ts, …
│       └── ptm/
│           ├── page.tsx              top-level PTM dashboard
│           ├── pending/              approval queue (teacher / admin)
│           ├── escalated/            manager escalation view
│           ├── issues/               auto-raised support tickets
│           ├── logs/                 delivery log + resend
│           ├── automation/           auto-generate opt-in, batch run controls
│           ├── students/[id]/        per-student detail
│           ├── students/[id]/knowledge  concept-mastery view
│           └── [id]/
│               ├── page.tsx          report preview + edit + approve
│               ├── print/            chromeless PDF render route
│               ├── diff/             version-to-version diff viewer
│               └── questionnaire/    rejection questionnaire
├── backend/                          FastAPI
│   ├── main.py                       app entry, CORS, lifespan migrations
│   ├── routers/ptm.py                all /api/ptm endpoints (~40 routes)
│   ├── services/
│   │   ├── claude_service.py         LLM draft generation (Azure GPT-5.1)
│   │   ├── pdf_service.py            Playwright PDF render + send-email orchestration
│   │   ├── email_service.py          Gmail SMTP wrapper (HTML body + PDF attachment)
│   │   ├── tts_service.py            TTS abstraction (gTTS / huggingface / browser)
│   │   ├── storage_service.py        Supabase storage uploader (pdfs, audio)
│   │   ├── wise_service.py           Mongo-backed student/session/email lookup
│   │   ├── version_service.py        snapshot every edit/approval as a version
│   │   ├── risk_service.py           students-at-risk signals
│   │   ├── knowledge_service.py      per-student concept mastery aggregation
│   │   ├── copilot_service.py        in-app teacher copilot chat
│   │   ├── form_assist_service.py    LLM-assisted manual-report form filler
│   │   └── issue_service.py          auto-raise tickets (e.g. missing email)
│   ├── db/
│   │   ├── connection.py             asyncpg pool + migration runner
│   │   ├── migrations/*.sql          8 migrations (see Database)
│   │   └── mongo.py                  motor client (Wise lookups)
│   └── seed.py                       seed data
├── n8n/                              future cron workflow exports
├── runtime.txt                       python-3.12.7 (Render pin)
├── CLAUDE.md                         agent rules (design, FE, BE)
├── README.md                         quickstart
├── screens.md                        canonical UI spec
└── .env.example                      all supported env vars
```

## Database (PostgreSQL, 11 tables)
All migrations in `backend/db/migrations/`, run idempotently on startup.

| Table | Purpose |
|---|---|
| `ptm_reports` | core record. id, student/teacher, subject, reporting_month, status, draft_content (JSONB), pdf_url, audio_url, teacher_note, regeneration_count, overall_confidence, tone_warmth, tone_detail, soft delete. |
| `ptm_questionnaire_responses` | engagement/concept/application ratings, topics correction, next-month topics, free-form note. |
| `ptm_delivery_log` | per-channel send status (`pending` → `sent`/`failed`/`skipped`), recipient (where the email actually went), intended_recipient (the on-record parent email — equal to recipient unless the teacher chose a custom address on approve), error_msg. |
| `ptm_report_versions` | full snapshot per edit/approval/regeneration. Every approved version has its rendered PDF URL. Powers the diff viewer + audit trail. |
| `ptm_audio_summaries` | provider, voice, script, audio_url, duration_seconds. |
| `ptm_risk_signals` | per-student signals computed from cross-month data — attendance dip, confidence drop, repeated weak concepts. |
| `ptm_copilot_messages` | conversation history for the in-app teacher copilot. |
| `ptm_student_concepts` | concept-level mastery rows from each report (status: weak / learning / mastered). |
| `ptm_student_knowledge` | per-student aggregated knowledge summary (LLM-distilled). |
| `ptm_teacher_settings` | per-teacher `auto_generate_enabled` flag + last_run timestamp. |
| `ptm_issues` | auto-raised tickets (e.g. `email_missing`, `delivery_failed`) with status, severity, resolution. |

**Report status enum:** `pending · approved · rejected · delivered · escalated`

## API surface (`/api/ptm`)
~40 routes — grouped by concern.

**Reports**
- `GET /reports` — list, filter by status / teacher_id / teacher_name
- `GET /reports/{id}` — single report
- `PATCH /reports/{id}` — save draft edits (snapshots a new version)
- `POST /reports/{id}/approve` — approve, render PDF, send email. Body: `{ teacher_note?, recipient_email? }`. `recipient_email` overrides Wise's on-record address.
- `DELETE /reports/{id}` — soft delete
- `POST /reports/{id}/reject` → returns dynamic questionnaire
- `GET /reports/{id}/questionnaire` · `POST /reports/{id}/questionnaire`
- `POST /reports/{id}/regenerate-tone` — re-render at a different warmth/detail without losing edits
- `GET /reports/{id}/parent-email` — current Wise email on record (used by ApproveModal)
- `POST /reports/{id}/pdf` — on-demand PDF re-render
- `POST /reports/{id}/audio-summary` · `GET /reports/{id}/audio-summary`
- `GET /reports/{id}/versions` · `GET /reports/{id}/versions/{n}` · `GET /reports/{id}/diff`
- `POST /reports/auto-fill-form` — LLM helper that prefills the manual-report form from selected sessions
- `POST /reports/from-sessions` — manual one-off report

**Generation**
- `POST /generate?month=` — bulk generate for all opted-in students
- `POST /auto-generate/run` — single-batch run (pulls active students, skips ones already done that month)

**Teachers**
- `GET /teachers` · `GET /teachers/auto-generate` · `PATCH /teachers/auto-generate`

**Students**
- `GET /students?teacher_name=` · `GET /students/{id}/sessions` · `GET /students/{id}/concepts`
- `POST /students/{id}/knowledge-summary/generate` · `GET /students/{id}/knowledge-summary`

**Escalation**
- `GET /escalated` · `POST /escalated/{id}/override` (manager force-approves)

**Risk**
- `POST /risk/recompute` · `GET /risk/students-at-risk` · `GET /risk/students/{id}`

**Copilot**
- `POST /copilot/message` · `GET /copilot/history`

**Operations**
- `GET /delivery-log` — paginated send history
- `POST /delivery-log/{id}/resend` — re-send a previously failed/skipped row
- `GET /issues` · `PATCH /issues/{id}` — auto-raised tickets
- `POST /issues/checks/email-records/run` — proactive sweep that opens `email_missing` tickets for any active student with no parent email on record

## Features

### Generation
- **1-page draft** with sections: header, sessions/attendance, learning coverage, student performance, confidence trend, strengths, growth areas, homework, milestone of the month, parent action items, next steps, recommended resources, at-home action plan, audio script.
- **Inferred-field flagging** — sections the LLM inferred (vs. observed) get an orange highlight + tooltip in the UI.
- **Per-section AI confidence** — `ai_confidence: { overall, sections: { academic_understanding, engagement, homework_consistency, communication } }`. Surfaced via `ConfidenceBadge`, `ConfidenceMeter`, `ConfidencePanel`.
- **Evidence chips** — every inferred field carries source-session refs + transcript snippets. Click to inspect.
- **Tone control** — two axes (warmth: warm/balanced/formal · detail: concise/balanced/detailed) without re-running the full pipeline; preserves teacher edits.
- **Form-assist** — for the manual flow, an LLM helper pre-fills engagement/concept/highlights/improvement-areas from selected session transcripts.

### Approval flow
- **Approval queue** at `/ptm/pending` with overdue banner (>24h pending), per-teacher filter (admin), per-status counters, mobile + desktop layouts.
- **Approve modal** — confirms recipient before sending. Shows the parent email on record (fetched from Wise via `/reports/{id}/parent-email`) and offers a custom-email override radio. When no email is on record, custom is forced. Custom address is passed as `recipient_email` to the approve endpoint and used by `pdf_service` instead of the Wise lookup.
- **Optional teacher note** appended to the email body.
- **Versioning** — every edit, regeneration, approval, and override is snapshotted. Rendered PDFs are stored per version.
- **Diff viewer** at `/ptm/[id]/diff` — block-level diff between any two versions.

### Rejection / regeneration
- **Dynamic questionnaire** — only shows questions for fields the teacher disputes (3 dropdowns + topics correction + next-month plan + free-form).
- **Regeneration cap** — max 2 cycles; 3rd rejection auto-escalates to the manager queue at `/ptm/escalated`.
- **Manager escalation view** with "Override & Deliver" / "Reassign".

### Delivery
- **Real Gmail SMTP send** with branded HTML body + PDF attachment. PDF is generated in a background task by `pdf_service` (Playwright headless Chromium → MP3 stored in Supabase `pdfs` bucket).
- **Per-approve recipient override** — the Approve modal lets the teacher swap the on-record parent email for a custom address on a single send (great for QA or sending to a different guardian). The on-record email is still recorded as `intended_recipient` so the Logs page flags overridden sends with a "sent to custom address" chip.
- **Delivery log** at `/ptm/logs` — searchable, channel filter (email/whatsapp), status filter. One-click resend on any failed/skipped row.
- **WhatsApp** — log row only; no real send wired up.

### Audio summaries
- 45–60s parent-friendly script generated as part of the report draft.
- `AudioSummaryCard` on the report preview triggers TTS, uploads MP3 to Supabase `audio` bucket, plays inline with a waveform animation.
- Provider is selected via `TTS_PROVIDER` env var. Currently `gtts` (free, no key). `huggingface` and `browser` providers also implemented.

### Issues / observability
- **Auto-raised issues** — `email_missing` opens automatically when an approval succeeds but Wise has no parent email; idempotent so duplicates don't accumulate.
- **`/ptm/issues`** — ticket queue with severity, status, resolution notes.
- **Email-records check** — manual sweep button that opens tickets for every active student missing an email, ahead of the next batch run.

### Risk + knowledge
- **Students-at-risk** signals computed across months (attendance dip, confidence drop, repeated weak concepts). Surfaced as a section on the dashboard and per-student.
- **Concept mastery** — every report contributes status rows (weak/learning/mastered) per concept; aggregated into a per-student knowledge view at `/ptm/students/[id]/knowledge`.
- **Knowledge summary** — LLM-distilled paragraph the teacher can regenerate.

### Automation
- **Per-teacher opt-in** for auto-generation (`ptm_teacher_settings.auto_generate_enabled`).
- **Batch runner** — `POST /auto-generate/run` pulls active students for the month, skips those already generated, processes a configurable batch size, returns a summary.
- **Auto-generate dashboard** at `/ptm/automation` to flip teachers on/off and trigger a batch.

### Copilot
- In-app chat alongside any report. Messages persisted in `ptm_copilot_messages`. Suggested-prompt chips for common asks ("explain this section", "soften the tone for this paragraph", "what evidence backs this claim").

### Auth
- Email-link login at `/login`. Roles: `teacher` (scoped to own reports) · `admin` (sees all teachers, can switch via dropdown).

## Workflow (intended)
1. **Cron trigger** — 1st of every month, 06:00 IST (n8n, future).
2. **Pull** class summaries + attendance + emails from Wise (Mongo).
3. **Generate** — Azure GPT-5.1 produces a 1-page JSON draft, tags inferred fields, per-section confidence, evidence, audio script.
4. **Queue** — drafts land in each teacher's "Pending Approval" list. >24h pending = stale banner.
5. **Review** — teacher edits inline, optionally re-tones, can preview the print render or generate the audio summary.
6. **Approve** — modal confirms recipient (on-record vs. custom) → background task renders PDF (Playwright) → uploads to Supabase → emails parent (Gmail SMTP) → logs in `ptm_delivery_log`. Missing email → ticket auto-opened.
7. **Reject** → dynamic questionnaire → regenerate (cap 2) → else escalate to manager queue.
8. **Audit** — every version is preserved. Logs page has resend. Issues page tracks anomalies.

## Design system (strict)
- Primary orange `#FF6B1F`, background `#FFF8F2` (`bg-ss-bg-50`).
- Tailwind v4 with token prefix `ss-`. Cards `rounded-2xl shadow-ss`. Buttons `rounded-full`.
- Lucide icons only. No new colors/fonts.
- Empty/loading/error states are mandatory: orange spinner or skeleton, icon+headline+1-line subtext, red-left-border + retry.
- Plus Jakarta Sans for headings, system stack for body.

## Run locally
```bash
# Backend
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
playwright install chromium                 # one-time, for PDF render
cp ../.env.example .env && fill in keys
uvicorn main:app --reload --port 8000

# Frontend
cd app
npm install
npm run dev                                 # http://localhost:3000
```

Required env vars (see `.env.example`):
- `AZURE_OPENAI_*` (LLM) · `MONGO_CONNECTION_STRING` (Wise) · `SUPABASE_*` (storage) · `SMTP_*` (email) · `SUPABASE_STRING` (PostgreSQL DSN) · `TTS_PROVIDER=gtts`

## Deployment
- **Backend** on Render (Oregon, US). Build = `pip install -r backend/requirements.txt && playwright install chromium`. Start = `uvicorn main:app --host 0.0.0.0 --port $PORT`. All env vars set in the Render dashboard. PostgreSQL is Supabase pooler.
- **Frontend** on Vercel — point `NEXT_PUBLIC_API_URL` at the Render backend URL.
- **Known constraint:** Render's shared egress IPs are flagged by ElevenLabs' free-tier abuse heuristic, which is why TTS uses gTTS in deployment. ElevenLabs config is kept in `.env.example` for reference if a paid plan or different host is used later.

## Current status (2026-05-10)
- ✅ Frontend: 14 routes, 30+ components, fully wired to backend.
- ✅ Backend: ~40 endpoints across reports, generation, delivery, automation, risk, knowledge, copilot, issues.
- ✅ LLM: Azure OpenAI GPT-5.1 live; deterministic mock when no key.
- ✅ Real Gmail SMTP delivery (per-approve custom recipient option for QA / alternate addresses).
- ✅ Playwright PDF render → Supabase storage.
- ✅ gTTS audio summaries → Supabase storage. (ElevenLabs path removed.)
- ✅ Versioning, diff viewer, tone re-render.
- ✅ Auto-generate opt-in + batch run.
- ✅ Issues + delivery log + resend.
- ✅ Risk signals, concept mastery, knowledge summary, copilot.
- ✅ Email-on-record confirmation card with custom-recipient override on approve.
- ✅ Render deploy live at `supersheldon-ptm.onrender.com`.
- 🚧 Not yet built: real WhatsApp send, n8n monthly cron, Slack reminder bot.
