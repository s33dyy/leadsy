# Leadsy Product State Freeze - 2026-06-06

This folder freezes the current deployed Leadsy product state as a context packet for a fresh ChatGPT thread.

Use these files when you want another AI session to understand what Leadsy is right now, what is real, what is not built yet, and what constraints it must respect before proposing the next implementation step.

## Files

- `CHATGPT_CONTEXT.md` - human-readable product, technical, deployment, and risk context.
- `CHATGPT_PROMPT.md` - ready-to-paste prompt for a new ChatGPT conversation.
- `PRODUCT_STATE_SNAPSHOT.json` - structured snapshot for tools or models that prefer JSON input.

## Snapshot Identity

- Snapshot date: 2026-06-06
- Local timezone: Asia/Kolkata
- Source branch when generated: `codex/product-state-freeze`
- Frozen product commit: `bdefede4acdee86f92ba8837509aa55cf38960d2`
- `origin/main` at freeze time: `bdefede4acdee86f92ba8837509aa55cf38960d2`
- Web Railway deployment: `74df3aa4-5b7d-4573-8101-c516ddc6d114`
- Web deployment status: `SUCCESS`
- Production health endpoint: `https://leadsy.up.railway.app/api/health`
- Production health result at freeze time: `ok`
- n8n Railway deployment: `47eb448c-a4c2-4866-b9e3-115bc21861af`
- n8n deployment status: `SUCCESS`
- n8n health endpoint: `https://n8n-production-3749.up.railway.app/healthz`
- n8n health result at freeze time: `{"status":"ok"}`

## Important Reading Rule

This packet is intentionally conservative. It should be treated as the source of truth over screenshots, old plans, or aspirational roadmap language. Anything not listed as implemented should be assumed unbuilt, partial, placeholder, or needing verification.

