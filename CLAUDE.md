# PTM AI Agent — Claude Context

## What this repo is
Internal automation tool for Sheldon Labs that replaces the 8–9 page manual Parent-Teacher Meeting report with a 1-page AI-generated report, routed through teacher approval before delivery to parents.

## Design system
Strictly follow `/DESIGN.md` (Super Sheldon). Primary = orange `#FF6B1F`. Tailwind token prefix = `ss-`. Lucide icons only. Cards = `rounded-2xl shadow-ss`. Buttons = `rounded-full`. Background = `bg-ss-bg-50` (`#FFF8F2`). Never invent a new color or font.

## Repo layout
- `/app` — Next.js 14 App Router frontend
- `/backend` — FastAPI Python backend (future)
- `/slack-bot` — Bolt.js Slack reminder bot (future)
- `/n8n` — exported n8n workflow JSONs (future)
- `screens.md` — canonical screen specs (written before any code)

## Frontend rules
- All pages use App Router (`app/` directory)
- Mock data lives in `app/lib/mock-data.ts` — never hardcode data in components
- No business logic in Next.js API routes — those belong in FastAPI
- Loading states: orange spinner or `animate-pulse` skeleton, never blank
- Empty states: icon + headline + 1-line subtext, never just "No data"
- Error states: red left border + plain explanation + retry button

## Backend rules (future)
- FastAPI, Python 3.11
- PostgreSQL — raw SQL only, no ORM, soft deletes (`deleted_at`)
- Sequential migration files in `/backend/db/migrations/`
- Claude calls use prompt caching on the system prompt
- No PII beyond first name, grade, subject in Claude prompts
- All secrets in env vars, never committed

## Agent workflow
1. Runs 1st of every month at 06:00 IST
2. Pulls class data from Wise (mock → real API)
3. Claude generates 1-page draft (JSON with inferred field tags)
4. Draft → teacher CRM "Pending Approval" queue
5. Teacher approves → deliver to parent (email PDF + WhatsApp)
6. Teacher rejects → dynamic questionnaire → regenerate (max 2 cycles → escalate)
