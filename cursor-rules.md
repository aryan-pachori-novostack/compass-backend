# Compass Backend — Cursor Workspace Rules

Follow these rules across the entire codebase:

## CORE PRINCIPLES
1. Entire project uses Node + Express + TypeScript.
2. All database tables, models, fields, variable names must be SNAKE_CASE only.
3. Prisma schema (prisma/schema.prisma) is the single source of truth.
4. All Prisma calls must use the existing schema fields exactly.
5. Use UUIDs and business IDs (*_id fields) exactly as defined.

## PROJECT STRUCTURE
- Business logic lives in /src/modules/*
- HTTP routing lives in /src/api/*
- Middlewares live in /src/middlewares/*
- Reusable utils in /src/utils/*
- Prisma client in /src/config/prisma.ts
- Environment loader in /src/config/env.ts

## SECURITY & PROD REQUIREMENTS
- Authentication MUST use JWT (Bearer token).
- Include rate limiting on all routes.
- Include global error handler with structured responses.
- Include production logging (Winston).
- Never expose stack traces in production.
- All protected routes must use authGuard middleware.

## CODING STANDARDS
- Use async/await only (no .then chains).
- Use try/catch in every API handler.
- Validate inputs using Zod or manual validators.
- Do not create camelCase DB fields ever.
- File and folder names also snake_case.
- Keep controllers thin; put business logic in services.

## API RULES
- All responses = JSON.
- Success: { data: ... }
- Errors: { error: "...", message?: "...", code?: nnn }
- HTTP codes must match behavior (400, 401, 404, 500).

## EXCLUDED FOR NOW
- No MRZ/OCR/AI features yet.
- No passport verification logic yet.
- No document upload logic yet.

## GOAL
Generate production-safe, scalable backend code with:
- partner onboarding
- country CRUD
- visa CRUD
- authentication
- rate limiting
- logging
- consistent prisma usage

ALWAYS follow these rules.
> **Workspace Rules:**  
> - All rules and standards on this page apply to _every_ repository file (including config, API, services, middleware, etc).
> - Every developer contributing to the workspace must follow these rules strictly.
> - Pull requests that violate any rule here must be rejected until they comply.
> - All new features, bug fixes, and refactors must be tested against these standards before merge.
> - Use this page as the source of truth for architectural or code style disputes.
> - Any suggested deviations or updates to these rules require team consensus and code review.
> - Keep this document up-to-date as workspace requirements evolve.
These are the definitive workspace rules.  
Every repository contributor must read, follow, and enforce this document.  
No changes, pull requests, or merges may proceed if these rules are violated. This document overrides any conflicting guidelines elsewhere in the workspace until amended by team consensus.

Summary:
- All code, configuration, schemas, services, tests, and documentation must comply with the sections above: **Security & Prod Requirements, Coding Standards, API Rules, and Goal**.
- Rule checks apply to existing code, new features, refactors, fixes, and all files in the workspace.
- Failure to follow these rules results in automatic PR rejection and mandatory fix-up before review can proceed.
- This ruleset governs technical decisions, architecture, naming, validation, error handling, authentication, logging, and business/domain boundaries.
- All contributions must be tested to confirm compliance.
- Any changes to these rules must go through code review and consensus by the team.
- Maintain and reference this document for all architectural or code-quality discussions.

Adherence to these workspace rules is required for project integrity and maintainability.
