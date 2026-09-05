# All-in-One Business CRM

A free CRM frontend built with Next.js, TypeScript, Tailwind CSS and Supabase.

## Project structure

The CRM lives in `/crm` so the existing AI social responder in the repository is preserved.

## Setup

```bash
cd crm
npm install
cp .env.example .env.local
npm run dev
```

Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in `.env.local`.

The backend schema is already provisioned in the connected Supabase project.
