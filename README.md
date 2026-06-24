# Live Wave Background

An interactive Three.js waveform background, tuning interface, and portfolio case
study. Scroll drives a smoothed camera path through the live scene while adaptive
quality targets a stable frame rate.

## Pages

- `/` - redirects to the portfolio case study
- `/webpage/` - portfolio case study
- `/scroll-demo/` - clean scroll-effect test page
- `/styleguide/` - interactive portfolio design system
- `/index.html` - wave tuner

## Regenerate The Scroll Demo

```bash
node scripts/capture-scroll-demo.mjs
```

This creates `webpage/assets/scroll-demo-boomerang.mp4` from the current shared
wave settings using the deployed Cloudflare site. Set `CAPTURE_SITE_URL` to
override the deployment URL.

## Deployment

The project deploys from GitHub through Cloudflare Workers Static Assets.
`_redirects` sends the public site root to the case study.

Cloudflare Workers Static Assets deployments use `.assetsignore` to keep Git
metadata and development scripts out of the public deployment.
