# ScopeFlow AI

**ScopeFlow AI** is an AI-powered proposal workspace for freelancers and agencies that turns rough client requirements into structured client-ready proposals.

It helps users create projects, generate content with Gemini AI, review quality, manage versions, track usage, reuse templates, seed demo data, and export work inside a SaaS dashboard.

[Live Demo](https://scope-flow-ai.vercel.app/) | [Dashboard Demo](https://scope-flow-ai.vercel.app/dashboard) | [Repository](https://github.com/skerdiD/ScopeFlow-AI)

---

## Preview

Explore the deployed app: [scope-flow-ai.vercel.app/dashboard](https://scope-flow-ai.vercel.app/dashboard)

### Landing Page

![ScopeFlow AI landing hero](./client/public/screenshots/landing-hero.png)

![ScopeFlow AI how it works section](./client/public/screenshots/landing-how-it-works-section.png)

### SaaS Dashboard

![ScopeFlow AI dashboard overview](./client/public/screenshots/dashboard-overview.png)

![ScopeFlow AI projects list](./client/public/screenshots/projects-list.png)

![ScopeFlow AI templates library](./client/public/screenshots/templates-library.png)

![ScopeFlow AI activity timeline](./client/public/screenshots/activity-timeline.png)

![ScopeFlow AI usage and billing](./client/public/screenshots/usage-billing.png)

---

## Overview

Proposal work is often scattered across calls, notes, messages, and client documents. ScopeFlow AI brings that workflow into one product where users can generate, edit, review, version, and deliver proposals faster.

This project demonstrates full-stack SaaS development, AI integration, authenticated APIs, security hardening, frontend checks, backend testing, CI, and deployment-ready engineering.

---

## Key Features

- Gemini proposal generation
- AI quality score
- Regenerate and improve content
- Dashboard statuses and activity
- Proposal versions
- Reusable templates
- Usage and billing overview
- DOCX and PDF export workflow
- Profile dropdown actions
- Demo data seeding
- User-scoped backend access
- Frontend linting, type-checking, Vitest, and GitHub Actions CI
- Backend tests with PostgreSQL CI

---

## Tech Stack

- React, TypeScript, Vite, Tailwind CSS
- Django and Django REST Framework
- Supabase Auth and PostgreSQL
- Google Gemini API
- Vercel, Render, GitHub Actions

---

## Getting Started

```bash
git clone https://github.com/skerdiD/ScopeFlow-AI.git
cd ScopeFlow-AI
cd client && npm install && npm run dev:web
