Build & deploy notes for Vercel

Overview
- This project is a TypeScript Node application that compiles to `dist/index.js` and runs a long-lived process (trading engine + dashboard).

Quick build & run commands (local)
- Build: `npm run build` or `npm run vercel-build`
- Start (run compiled output): `npm run start` or `npm run vercel-start`

Deploying to vercel.com — important notes
- Vercel is optimized for serverless functions and static sites. It does NOT support running long-lived background processes (daemons) or hosting apps that call `listen()` in a persistent Node server the same way a VPS or PaaS (e.g., Render, Heroku) does.
- Because this repository starts a trading engine and opens persistent sockets, deploying the entire app to Vercel will not behave as expected.

Recommended options
1) Deploy only the dashboard (static assets or client) to Vercel, and run the trading engine on a VM/PaaS.
2) Rework the project to expose server functionality as serverless API endpoints (e.g., move handlers into `api/*` routes) so Vercel's serverless functions can run on demand.
3) Use alternative hosting that supports long-running Node processes (Render, DigitalOcean App Platform, AWS EC2, etc.) if you need the full persistent server behavior.

Vercel CLI example (static dashboard deploy)
1. Build locally: `npm run build`
2. In the dashboard output folder (if you produce static files), run: `vercel deploy --prod`

If you want help adapting the project for Vercel's serverless model, I can propose a migration path and make the necessary changes.
