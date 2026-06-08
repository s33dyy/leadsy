# Leadsy 5-Second Teaser

Premium 5-second teaser for Leadsy using the OpenMontage cinematic pipeline as the production plan and Remotion as the locked render runtime.

## Source Assets

- Production UI: `https://leadsy.up.railway.app`, captured from Brave Browser.
- Scene 1 asset: `../public/leadsy-teaser/ui/dashboard-brave.png`.
- Scene 2 asset: `../public/leadsy-teaser/lifestyle/reading-couch.jpg`.
- Audio: generated local ambient pad plus a single click impact, no voiceover.

## Render

```bash
node validate.mjs
../../../node_modules/.bin/remotion render ./src/index.tsx LeadsyTeaser ../public/videos/leadsy-click-it-forget-it.mp4 --codec=h264 --crf=18 --concurrency=2
```

Output:

```text
apps/web/public/videos/leadsy-click-it-forget-it.mp4
```
