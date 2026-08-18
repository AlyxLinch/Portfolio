# Alyx Linch Portfolio

A static portfolio organized around public pages, categorized projects, and a
separate studio for development tools and retired drafts.

## Public pages

- `/` — portfolio landing page and full project overview
- `/profile/` — bio and design perspective
- `/connect/` — Formspree contact form (form ID still needs configuration)
- `/resume/` — HTML résumé and PDF download

## Project structure

Project routes live under `/projects/<category>/<project>/`. Category README files
track pages that are live and those still planned.

- `product-design/`
- `websites/`
- `personal/`
- `graphic-design/`
- `software-solutions/`

## Studio

`/studio/` is intentionally absent from the public navigation. It provides a
direct-link dashboard for the wave tuner, scroll demo, squircle lab, style guide,
and archived pages. This separates workbench pages from the final portfolio while
keeping them accessible on the deployed site.

## Reactive color

Use `.reactive-color` on text or an inline SVG that sits directly over the live
WebGL background. Use `.reactive-color.reactive-color--shape` for a flat filled
shape; its current border radius is preserved in the GPU mask.

```html
<h2 class="reactive-color">Reactive heading</h2>
<svg class="reactive-color" aria-hidden="true">...</svg>
<span class="reactive-color reactive-color--shape" aria-hidden="true"></span>
```

The color map sends Forest/Plum/Yellow mixtures to the same Cyan/Pink/Orange
mixtures. It smoothly becomes a regular RGB inverse as the sampled background
moves away from either the design-system or live-renderer primary palette. Set
`--reactive-color-fallback` to customize the ordinary difference-blend fallback.

The exact mapped effect is intended for elements directly over the live background;
cards, photographs, and other HTML layers are outside the mask's sampling scope. The
mask is rendered inside the existing background post-process and shifted by the exact
scroll delta, avoiding a second full-screen GPU canvas or a separate scrolling layer.
The flow-element mask includes half a viewport of vertical overscan above and below the
screen, so text and icons are ready before they cross a visible edge.
Wheel and trackpad deltas are applied at the start of that same render frame so the DOM
and reactive mask are composited from one scroll position; touch and keyboard scrolling
remain native for accessibility.

## Regenerate The Scroll Demo

```bash
node scripts/capture-scroll-demo.mjs
```

This creates `assets/scroll-demo-boomerang.mp4` from the current shared
wave settings using the deployed Cloudflare site. Set `CAPTURE_SITE_URL` to
override the deployment URL.

## Deployment

The project deploys from GitHub through Cloudflare Workers Static Assets.
`_redirects` preserves the previous page and project URLs after the restructure.

Cloudflare Workers Static Assets deployments use `.assetsignore` to keep Git
metadata and development scripts out of the public deployment.
