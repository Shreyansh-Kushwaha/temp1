# PTM AI Agent

Automates monthly Parent-Teacher Meeting reports for Sheldon Labs. Replaces the manual 8–9 page PTM template with a 1-page AI-generated report — approved by the teacher, delivered to parents via email and WhatsApp.

## Stack

| Layer | Tech |
|---|---|
| Frontend | Next.js 14 (App Router) + Tailwind CSS |
| Backend | FastAPI (Python 3.11) |
| LLM | Claude (Anthropic) with prompt caching |
| Database | PostgreSQL (raw SQL, no ORM) |
| Worker | DB-polling Python worker + Playwright (PDF) |
| Slack bot | Bolt.js |
| Delivery | Gmail SMTP + WhatsApp Business API |
| Deploy | Render (frontend + API) |

## How to run locally

### Frontend
```bash
cd app
npm install
npm run dev
# → http://localhost:3000
```

### Backend (coming soon)
```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload
```

## Env vars
See `.env.example` for all required variables.

## Screens
See `screens.md` for the full UI spec.

## How it works
1. Agent triggers on the 1st of every month at 06:00 IST
2. Pulls class summaries and attendance from the Wise portal
3. Claude generates a 1-page draft report (with conservative assumptions where data is thin)
4. Draft lands in the teacher's "Pending Approval" queue in the CRM
5. Teacher approves → report delivered to parent (email PDF + WhatsApp)
6. Teacher rejects → short dynamic questionnaire → report regenerated (max 2 cycles, then manager escalation)
