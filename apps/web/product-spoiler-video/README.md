# Leadsy Product Spoiler Video

OpenMontage-backed Remotion production for:

> Leadsy. Click it. Forget it. Get your number today.

## Pipeline

- OpenMontage pipeline: `screen-demo`
- Production mode: `real_capture`
- Browser source: Brave Browser against local `http://localhost:3000`
- Renderer: Remotion
- Voiceover: OpenMontage `piper_tts` with `en_US-lessac-medium`
- Output: `apps/web/public/videos/leadsy-product-spoiler.mp4`

## Rebuild

1. Install OpenMontage outside this repo:

   ```bash
   git clone https://github.com/calesthio/OpenMontage.git /Users/pratikchoudhuri/Documents/OpenMontage
   cd /Users/pratikchoudhuri/Documents/OpenMontage
   /Users/pratikchoudhuri/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 -m venv .venv
   PATH="/Users/pratikchoudhuri/Documents/OpenMontage/.venv/bin:$PATH" make setup
   PATH="/Users/pratikchoudhuri/Documents/OpenMontage/.venv/bin:$PATH" python -m piper.download_voices en_US-lessac-medium --download-dir /Users/pratikchoudhuri/Documents/OpenMontage
   ```

2. Capture product frames from Brave Browser using the local seeded demo workspace. Store reusable media under `apps/web/public/product-spoiler-video/`.

3. Validate the plan:

   ```bash
   node apps/web/product-spoiler-video/validate.mjs
   ```

4. Render:

   ```bash
   mkdir -p apps/web/public/videos
   cd apps/web/product-spoiler-video
   REMOTION_DISABLE_VERSION_CHECK=1 npx remotion render src/index.tsx LeadsyProductSpoiler ../public/videos/leadsy-product-spoiler.mp4 --codec=h264 --crf=20 --concurrency=2
   ```

## Creative Notes

The ad uses real captured UI frames for landing, dashboard, leads, inbox, approvals, team chat, follow-up tasks, and settings. The four spoken phrases are intentionally sparse and are timed to match the large on-screen phrase punches, while the UI frames carry the product proof between voiceover beats.
