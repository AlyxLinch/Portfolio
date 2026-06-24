# Live Wave Background

An interactive Three.js waveform background, tuning interface, and portfolio case
study. Scroll drives a smoothed camera path through the live scene while adaptive
quality targets a stable frame rate.

## Pages

- `/` - local wave tuner
- `/webpage/` - portfolio case study
- `/scroll-demo/` - clean scroll-effect test page

## Local Development

```bash
node server.js
```

Open `http://127.0.0.1:4173/webpage/`.

The local server includes the `/api/settings` endpoint used by the tuner’s
**Save settings** button. A static deployment serves the visual pages normally,
but does not provide that local write endpoint.

## Regenerate The Scroll Demo

With the local server running:

```bash
node scripts/capture-scroll-demo.mjs
```

This creates `webpage/assets/scroll-demo-boomerang.mp4` from the current shared
wave settings.

## Deployment

The project can be deployed directly as a static site through Cloudflare Pages:

- Framework preset: None
- Build command: leave blank
- Build output directory: `/`

The case study is available at `/webpage/`.
