# EXTENSION RETIREMENT REPORT

Generated for the Twilio CRM transformation on 2026-06-06.

## Decision

The browser extension is retired as a primary product surface and is now marked internally as the **Legacy Capture Layer**.

## Removed from primary navigation

- Removed the extension-specific sidebar shortcut: `Extension worker`.
- Removed the direct navigation link to `/app/worker?view=extension`.
- Kept the primary `Automations` route because it remains the broader operator automation surface.

## Preserved extension APIs

The extension API route structure remains in place for existing users:

- `apps/web/src/app/api/extension/capture/route.ts`
- `apps/web/src/app/api/extension/context/route.ts`
- `apps/web/src/app/api/extension/conversations/sync/route.ts`
- `apps/web/src/app/api/extension/copilot/route.ts`
- `apps/web/src/app/api/extension/reply/route.ts`
- `apps/web/src/app/api/extension/tasks/route.ts`
- `apps/web/src/app/api/extension/tasks/[taskId]/route.ts`
- `apps/web/src/app/api/extension/tasks/generate/route.ts`
- `apps/web/src/app/api/extension/tokens/route.ts`

## Preserved extension package

The extension package remains in the repository:

- `apps/extension`

No extension package deletion was performed.

## Product surface changes

- The app shell no longer exposes the extension-specific worker shortcut.
- The worker page labels extension pairing and browser fallback as **Legacy Capture Layer**.
- The connect page demotes extension pairing beneath official channel transport.

## Compatibility

Existing extension users should keep their pairing tokens and APIs. The Phase 0 reset plan preserves extension tokens while allowing stale extension conversations, messages, tasks, task events, and approvals to be cleared only after backup and explicit reset confirmation.

## Forward path

Twilio WhatsApp becomes the primary conversation transport. The extension remains a fallback capture layer only for unsupported or blocked browser surfaces.
