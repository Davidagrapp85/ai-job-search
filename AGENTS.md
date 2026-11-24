---
framework_version: 1.0.0
---

# Agent Guidelines: AI Job Search

This workspace is structured to manage job search activities, scraper tools, CVs, cover letters, and interview preparation.

## Thin-Pointer Design (Single Source of Truth)

To prevent duplication and configuration drift across different AI agent frameworks (Claude Code, Google Antigravity, Codex, Cursor, Gemini CLI, etc.), this workspace uses a unified thin-pointer design. All agent runtimes should load the canonical specifications and candidate profiles from the files and directories below:

1. **Personal Candidate Profile:**
   - The candidate profile, contact details, education, and target preferences are defined in [CLAUDE.md](CLAUDE.md) and the individual profile methodology files under [.claude/skills/job-application-assistant/](.claude/skills/job-application-assistant/) (specifically `01-*.md` etc.).
2. **Canonical Workflow Specifications:**
   - The step-by-step instructions and triggers for tasks (setup, scrape, rank, apply, upskill, interview) are defined in the [.claude/](.claude/) directory (specifically under `.claude/skills/` and `.claude/commands/`).
   - Do not duplicate these rules or specifications. Treat `.claude/` files as the single source of truth.
3. **Portal Search Skills:**
   - Job-portal search CLIs live under [.agents/skills/](.agents/skills/) in the portable Agent Skills format (with a `SKILL.md` per portal). Codex and Antigravity discover these automatically; the `/scrape` workflow in [.claude/skills/job-scraper/](.claude/skills/job-scraper/) orchestrates them.

<!-- CCE-100:START -->
## CCE-100 — Comunicación Clara y Estructurada (v1.2.0)

Aplica CCE-100 como estándar por defecto para respuestas, documentación e instrucciones a agentes. Da la respuesta principal primero. Escribe una idea por oración y una acción por paso. Utiliza verbos concretos, voz activa y terminología consistente. Preserva todos los datos, fuentes, términos legales, matices y excepciones. Distingue hechos, hipótesis y límites de información. Adapta el formato a la tarea. No confundas esta adaptación con cumplimiento oficial ASD-STE100. Para revisión detallada, utiliza la skill `cce-100`. Las actualizaciones requieren pruebas, versión y aprobación humana.
<!-- CCE-100:END -->
