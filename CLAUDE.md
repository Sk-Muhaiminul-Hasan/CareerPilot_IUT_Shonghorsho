# Project: CareerPilot_IUT_Shonghorsho

CareerPilot is an AI-powered job application automation system that helps users discover jobs across platforms, generate tailored resumes with ATS optimization, and track applications with real-time progress.

---

## Your operating instructions

**Step 1:** Read CLAUDE.md (you are here).

**Step 2:** Identify mode - Plan (design/think), Act (build/fix/write), or Question (ask). If unclear, ask.

**Step 3 (Plan):** Read .claude/requirements.md, .claude/features/<name>.md, .claude/architecture.md, .claude/data-model.md, .claude/api-routes.md. Write .claude/active-plan.md.

**Step 4 (Act):** Read .claude/active-plan.md, .claude/rules.md, .claude/conventions.md, .claude/known-errors.md, .claude/features/<name>.md. Then write code.

---

## Context files

| File | Read when |
|------|-----------|
| .claude/stack.md | Need tech stack or run/build/test commands |
| .claude/architecture.md | Need folder structure, data flow |
| .claude/conventions.md | Writing or reviewing any code |
| .claude/rules.md | Before writing any code |
| .claude/requirements.md | Need to know if in scope |
| .claude/data-model.md | Touching DB, types, schema |
| .claude/api-routes.md | Touching routes, payloads, auth |
| .claude/decisions.md | Suggesting libraries or architecture |
| .claude/progress.md | What is built or pending |
| .claude/known-errors.md | Hit a bug or unexpected issue |
| .claude/active-plan.md | In act mode - read before coding |
| .claude/features/<name>.md | Planning or building a feature |

---

Start dev: docker compose up --build | Backend tests: cd backend && pytest tests/ -v | Frontend dev: cd frontend && npm run dev
