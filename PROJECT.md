# PTM AI Agent — Project Overview

## What it is
Internal automation for **Sheldon Labs** that replaces the 8–9 page manual Parent-Teacher Meeting report with a **1-page AI-generated report**, gated by teacher approval, then delivered to parents via email + WhatsApp.

## Goal
Cut teacher prep time, standardise PTM output, and remove human bottleneck while keeping the teacher as the final reviewer.

## Stack (as documented vs. actual)
| Layer | Documented (README) | Actual in code |
|---|---|---|
| Frontend | Next.js 16 (App Router) + Tailwind v4 | same — React 19, framer-motion, lucide-react |
| Backend | FastAPI (Python 3.11) | same |
| LLM | Claude w/ prompt caching | `google-generativeai` (Gemini) in requirements |
| DB | PostgreSQL, raw SQL, soft deletes | SQLite (`aiosqlite`, `ptm.db`) — schema matches |
| Worker | DB-poll Python + Playwright PDF | not yet present |
| Slack bot | Bolt.js | not yet present |
| Delivery | Gmail SMTP + WhatsApp Business | mocked (rows in `ptm_delivery_log`) |
| Deploy | Render | n/a |

## Repo layout
```
PTM-Report-Generator/
├── app/                       Next.js frontend
│   └── app/
│       ├── page.tsx           landing
│       ├── components/        Navbar, ScrollPathSystem, StatusBadge
│       ├── lib/               api.ts, mock-data.ts
│       └── ptm/
│           ├── page.tsx              approval queue
│           ├── pending/              pending reports view
│           ├── escalated/            manager escalation view
│           ├── students/[student_id] per-student detail
│           └── [id]/
│               ├── page.tsx          report preview
│               ├── print/            PDF-ready render
│               └── questionnaire/    rejection questionnaire
├── backend/                   FastAPI
│   ├── main.py                app entry, CORS, lifespan migrations
│   ├── routers/ptm.py         all /api/ptm endpoints
│   ├── services/
│   │   ├── claude_service.py  LLM draft generation
│   │   └── wise_service.py    student/session data (Wise mock)
│   ├── db/
│   │   ├── connection.py      aiosqlite + migration runner
│   │   ├── mongo.py           (motor — unused)
│   │   └── migrations/001_init.sql
│   ├── seed.py                seed data
│   └── ptm.db                 SQLite store
├── CLAUDE.md                  agent rules (design, FE, BE)
├── README.md                  quickstart
└── screens.md                 canonical UI spec (5 screens)
```

## Database (SQLite, 3 tables)
- `ptm_reports` — id, student/teacher, subject, reporting_month, status, draft_content (JSON), pdf_url, teacher_note, regeneration_count, timestamps, soft delete.
- `ptm_questionnaire_responses` — engagement/concept/application ratings, topics correction, next-month topics, free-form note.
- `ptm_delivery_log` — per-channel (email/whatsapp) send status.

**Status enum:** `pending · approved · rejected · delivered · escalated`

## API surface (`/api/ptm`)
| Method | Path | Purpose |
|---|---|---|
| GET  | `/students?teacher_name=` | list a teacher's students |
| GET  | `/students/{id}/sessions` | per-student sessions |
| GET  | `/teachers` | all teachers |
| POST | `/reports/from-sessions` | manual report from selected sessions |
| GET  | `/reports?status=&teacher_id=&teacher_name=` | list reports |
| GET  | `/reports/{id}` | single report |
| PATCH| `/reports/{id}` | save draft edits |
| POST | `/reports/{id}/approve` | approve + mock-deliver |
| POST | `/reports/{id}/reject` | reject + return questions |
| GET  | `/reports/{id}/questionnaire` | dynamic questions for inferred fields |
| POST | `/reports/{id}/questionnaire` | submit answers → regen or escalate |
| POST | `/generate?month=` | bulk-generate for all active students |
| GET  | `/escalated` | list escalated |
| POST | `/escalated/{id}/override` | manager overrides + delivers |

## Features
- **1-page report draft** with 6 blocks: header, sessions/attendance, learning coverage, student performance, next steps, teacher's note.
- **Inferred-field flagging** — sections the LLM inferred (vs. observed) get an orange highlight + tooltip in the UI.
- **Approval queue** with overdue banner (>24h pending).
- **Dynamic rejection questionnaire** — only shows questions for fields the teacher disputes (3 dropdowns + topics correction + next-month plan + free-form).
- **Regeneration cap** — max 2 cycles; 3rd rejection auto-escalates to manager.
- **Manager escalation view** with "Override & Deliver" / "Reassign".
- **Manual on-demand report** from a student's selected sessions, with optional teacher overrides (engagement, concept understanding, homework effort, highlights, improvement areas, parent note, next-month goals).
- **Mock delivery** logging email + WhatsApp on approval.
- **Print/PDF route** (`/ptm/[id]/print`) — clean render with no UI chrome, intended for Playwright PDF capture.

## Workflow (intended)
1. **Cron trigger** — 1st of every month, 06:00 IST.
2. **Pull** class summaries + attendance from Wise portal (currently mocked in `wise_service`).
3. **Generate** — Claude/Gemini produces a 1-page JSON draft and tags inferred fields.
4. **Queue** — draft lands in teacher's "Pending Approval" list.
5. **Approve** → optional teacher note → email PDF + WhatsApp dispatch.
6. **Reject** → dynamic questionnaire → regenerate (cap 2) → else escalate to manager.

## Design system (strict)
- Primary orange `#FF6B1F`, background `#FFF8F2` (`bg-ss-bg-50`).
- Tailwind token prefix `ss-`. Cards `rounded-2xl shadow-ss`. Buttons `rounded-full`.
- Lucide icons only. No new colors/fonts.
- Empty/loading/error states are mandatory (skeleton, icon+headline, red-border+retry).

## Run locally
```bash
# Frontend
cd app && npm install && npm run dev          # :3000

# Backend
cd backend && python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload                     # :8000
```

## Current status (2026-05-08)
- Frontend: 5 screens scaffolded, mock-data wired via `app/lib/`.
- Backend: FastAPI + SQLite functional; full CRUD + approval/rejection/regeneration/escalation flows implemented; delivery mocked.
- LLM: actual provider in code is Gemini; docs still say Claude — needs reconciliation.
- Not yet built: real Wise integration, Playwright PDF, Gmail/WhatsApp delivery, Slack bot, n8n cron, Render deploy.
