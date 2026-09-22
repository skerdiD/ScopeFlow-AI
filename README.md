# ScopeFlow AI

**ScopeFlow AI** is a full-stack AI proposal workspace built with **React**, **TypeScript**, **Vite**, **Express**, **Prisma**, **Supabase Auth**, **PostgreSQL**, and **Gemini AI**.

It helps freelancers and agencies turn rough client requirements into structured proposals, review proposal quality, manage versions, reuse templates, track usage, and export client-ready files.

[Live Demo](https://scope-flow-ai.vercel.app/) | [Dashboard Demo](https://scope-flow-ai.vercel.app/dashboard) | [Repository](https://github.com/skerdiD/ScopeFlow-AI)

---

## Demo Account

Email: [demo@scopeflow.ai](mailto:demo@scopeflow.ai)
Password: Demo123456!

The demo account is public and only for exploring the app experience. It uses sample projects, proposal versions, templates, activity records, and usage data.

To seed or reset demo data locally:

```bash
npm run seed:demo
npm run seed:demo:reset
```

Before using the deployed demo login:

1. Create and confirm `demo@scopeflow.ai` in Supabase Auth with the password above.
2. Run `npm run seed:demo:reset` from `server/` against the deployed database.

The seed command creates the matching local database workspace; it does not bypass or create the Supabase Auth user.
The backend also verifies the workspace after demo authentication and automatically repairs missing projects, plan, or current-period usage data in the database serving the API.

---

## Preview

Explore the deployed app: [scope-flow-ai.vercel.app/dashboard](https://scope-flow-ai.vercel.app/dashboard)

### Landing Page

<img src="./client/public/screenshots/landing-hero.png" alt="ScopeFlow AI landing hero" width="100%">
<img src="./client/public/screenshots/landing-how-it-works-section.png" alt="ScopeFlow AI how it works section" width="100%">

### SaaS Dashboard

<img src="./client/public/screenshots/dashboard-overview.png" alt="ScopeFlow AI dashboard overview" width="100%">
<img src="./client/public/screenshots/projects-list.png" alt="ScopeFlow AI projects list" width="100%">
<img src="./client/public/screenshots/templates-library.png" alt="ScopeFlow AI templates library" width="100%">
<img src="./client/public/screenshots/activity-timeline.png" alt="ScopeFlow AI activity timeline" width="100%">
<img src="./client/public/screenshots/usage-billing.png" alt="ScopeFlow AI usage and billing" width="100%">

---

## Overview

Most proposal tools are either too manual or too generic. ScopeFlow AI was built to feel closer to a real SaaS workspace for freelancers and agencies.

Users can create client projects, add goals, budgets, timelines, and notes, generate proposal drafts with Gemini AI, review proposal quality, save versions, reuse templates, track usage, and export polished DOCX/PDF proposals.

The goal was to show more than an AI wrapper: authenticated APIs, user-scoped data, proposal workflow design, export logic, usage tracking, testing, deployment, and product-focused UX.

---

## Business Value

ScopeFlow AI helps freelancers and agencies save time during the proposal process while making client communication more structured and professional.

For clients, it shows the foundation of a practical proposal SaaS where users can organize discovery notes, generate scopes, review quality, reuse templates, manage versions, and export client-ready proposals.

---

## Key Features

### Auth and Workspace

* Supabase authentication
* Protected dashboard routes
* Token-based backend access
* User-scoped project data

### Project Management

* Create client proposal projects
* Store goals, budget, timeline, and notes
* Track draft, active, review, and completed states
* Search, filter, update, and delete projects
* View recent workspace activity

### AI Proposal Generation

* Generate proposals from rough client inputs
* Create scope, deliverables, pricing, risks, and next steps
* Use Gemini AI through protected backend endpoints
* Keep AI logic and keys server-side

### AI Quality Review

* Review proposals with an AI quality score
* Show strengths, weaknesses, and recommendations
* Help users improve clarity and client readiness

### Versions and Templates

* Save proposal versions
* Mark final client-ready versions
* Regenerate and improve proposal content
* Create reusable proposal templates

### Usage, Export, and Quality

* Track AI usage and generation limits
* Export proposals to DOCX and PDF
* Seed realistic demo data
* Run frontend and backend tests
* Support deployment on Vercel and Render

---

## Tech Stack

### Frontend

* React
* TypeScript
* Vite
* Tailwind CSS
* TanStack Query
* React Router
* Lucide React

### Backend and Database

* Node.js
* TypeScript
* Express.js
* Prisma ORM
* PostgreSQL
* Supabase Auth
* Supabase token verification
* User-scoped project data

### AI, Export, and Tooling

* Google Gemini API
* DOCX export
* PDF export
* Vitest
* React Testing Library
* ESLint
* GitHub Actions

---

## Architecture

```txt
Client UI
  |-- React / Vite / TypeScript / Tailwind
  |-- Dashboard / Projects / Templates / Usage / Activity

Auth Layer
  |-- Supabase Authentication
  |-- Protected Routes
  |-- Token-Based API Access
  |-- User-Scoped Data

Backend Layer
  |-- Node.js / TypeScript / Express
  |-- Prisma ORM mapped to the existing database
  |-- Project APIs / Template APIs / Usage APIs
  |-- Export APIs / AI Review APIs

Data and AI Layer
  |-- Supabase PostgreSQL
  |-- Projects / Proposal Versions / Usage / Quality Reviews
  |-- Browser storage for templates and activity history
  |-- Gemini AI
```

Proposal data is scoped to the authenticated user, AI logic stays server-side, and exports turn generated proposals into client-ready files.

---

## Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/skerdiD/ScopeFlow-AI.git
cd ScopeFlow-AI
```

### 2. Install frontend dependencies

```bash
cd client
npm install
```

### 3. Create frontend environment variables

Create a `.env` file inside the `client` folder:

```env
VITE_API_BASE_URL=
VITE_API_URL=
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

### 4. Install backend dependencies and generate Prisma Client

```bash
cd ../server
npm install
npm run prisma:generate
```

### 5. Create backend environment variables

Create a `.env` file inside the `server` folder:

```env
NODE_ENV=development
HOST=0.0.0.0
PORT=8000
API_PREFIX=/api
CORS_ALLOWED_ORIGINS=http://127.0.0.1:5173,http://localhost:5173
DATABASE_URL=
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_AUTH_CACHE_TTL=30
SUPABASE_AUTH_CACHE_MAX_ENTRIES=1000
REDIS_URL=redis://localhost:6379
SHARE_LINK_EXPIRY_DAYS=14
GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.5-flash
```

### 6. Run and start

```bash
npm run dev
```

Open a second terminal:

```bash
cd client
npm run dev:web
```

Open the frontend at:

```txt
http://localhost:5173
```

---

## Available Scripts

### Frontend

```bash
npm run dev:web       # Start frontend
npm run build         # Build frontend
npm run preview       # Preview build
npm run lint          # Run ESLint
npm run typecheck     # Run TypeScript checks
npm run test          # Run frontend tests
```

### Backend

```bash
npm run dev             # Start the Express development server
npm run typecheck       # Run backend TypeScript checks
npm test                # Run backend tests
npm run build           # Compile the production backend
npm start               # Start the compiled backend
npm run prisma:generate # Generate Prisma Client
npm run seed:demo       # Seed demo data
npm run seed:demo:reset # Reset only demo-scoped data, then reseed
```

---

## Testing and Quality

* Vitest validates frontend behavior
* React Testing Library supports component tests
* Vitest validates backend proposal logic without real Gemini calls
* TypeScript catches frontend and backend type issues
* ESLint keeps code quality consistent
* GitHub Actions runs quality checks

Run frontend checks:

```bash
cd client
npm run lint
npm run typecheck
npm run test
```

Run backend tests:

```bash
cd server
npm test
```

---

## Author

Built by **skerdiD**.

GitHub: [@skerdiD](https://github.com/skerdiD)
