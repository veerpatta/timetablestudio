# CLAUDE.md

Read and obey `AGENTS.md` in this directory — it is the full operating contract for this repo.

Then read, in order: `docs/SCHOOL_CONTEXT.md`, `docs/DATA_MODEL.md`, `docs/CONSTRAINTS.md`, `docs/ARCHITECTURE.md`, `docs/ROADMAP.md`, `docs/HANDOFF.md`.

Session protocol: `docs/HANDOFF.md` holds the current state and next action — keep it updated per AGENTS.md § 5. Session prompts (marathon/resume) are in `docs/PROMPTS.md`.

Key reminders:

- Work milestones strictly in order (`docs/ROADMAP.md`); do not skip ahead.
- No backend, no paid services, solver in a Web Worker, deterministic with seed.
- Domain types live only in `src/domain/types.ts`; `docs/DATA_MODEL.md` is authoritative.
- `npm test` and `npm run build` must pass before reporting a task complete.
- Log non-obvious choices in `docs/DECISIONS.md`.

<!-- BEGIN:browserstack -->
## Cross-browser and real-device testing (BrowserStack)

BrowserStack (Janmejay's GitHub Student Pack licence) is available for this project. Use it after UI, CSS, layout, PWA or mobile changes to check the real browsers and phones that local Chromium can't show - Safari on iPhone, Chrome on Android, Edge and Firefox on Windows.

- **Coding agents (Claude Code, Codex, Cursor):** `.mcp.json` registers BrowserStack's official remote MCP server as `browserstack` (one-time `/mcp` sign-in). Codex: `codex mcp add browserstack --url https://mcp.browserstack.com/mcp`, then `codex mcp login browserstack`.
- **Agents that drive Chrome (Cowork / Claude in Chrome):** Janmejay's Chrome has the BrowserStack extension installed and is signed in - use https://live.browserstack.com/dashboard.
- How-to, default device set, localhost testing and troubleshooting: [docs/BROWSERSTACK.md](docs/BROWSERSTACK.md).
- Never a blocker: if BrowserStack isn't available (no sign-in, plan limit, network), say so in your summary and carry on.
<!-- END:browserstack -->
