# Leadsy Chat Auto Responder

A private Chrome Manifest V3 extension for arming an AI auto-responder inside open web chat pages.

## Local Setup

1. Copy `.env.example` to `.env.local`.
2. Put your OpenRouter key in `.env.local`.
   The default model route uses `openrouter/free` first, then very cheap paid fallbacks if the free route returns no usable content.
3. Run `npm install`.
4. Run `npm run build`.
5. Open `chrome://extensions`, enable Developer mode, and load the `dist` folder as an unpacked extension.

The generated `dist` folder is intentionally ignored because private builds include the local OpenRouter key.
