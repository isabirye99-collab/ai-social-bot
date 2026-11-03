# Johden Business Consultancy Services — Public Website

Standalone public marketing website for Johden Business Consultancy Services. This application lives in its own directory so the existing CRM and billing application can remain separate.

## Stack
- Next.js App Router
- React
- TypeScript
- Custom responsive CSS
- Premium navy, white and gold visual identity

## Local development
From this directory:

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Build check

```bash
npm run build
```

## Deployment
Deploy this directory as a separate project on a Next.js-compatible hosting provider such as Vercel. Set the project Root Directory to `johden-website`. Configure the chosen Johden domain in the hosting dashboard after the first successful deployment.

## Before launch
- Confirm official company email, telephone and WhatsApp details.
- Add verified company address and social profile links.
- Replace illustrative dashboard artwork with real product screenshots when available.
- Add a secure enquiry form and privacy notice.
- Add analytics and search-console verification.
- Review all service descriptions and claims for accuracy.

## Separation and security
Do not place Supabase service-role keys or billing credentials in this public website. Any future integration with CRM or billing should use authenticated server-side endpoints and least-privilege access controls.
