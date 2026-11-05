# Kori

Coming-soon site for Kori: a dark editorial page built around an animated ASCII
rendition of Michelangelo's *Creation of Adam*.

The deliverable is a single self-contained `index.html`. Fonts and GSAP load
from CDNs; everything else (styles, scripts, ASCII) is inline.

## Preview

```sh
node tools/serve.mjs
# http://localhost:4517
```

Any static server works, for example `npx serve .`.

## Build

The page is generated from `tools/index.template.html` plus the ASCII snippet,
never edited by hand:

```sh
cd tools/ascii
npm install
node generate.mjs
node merge.mjs
```

`generate.mjs` samples `adam.jpg` (a public-domain detail of the fresco from
Wikimedia Commons), splits the hands at the fingertip gap, and writes
`kori-ascii.js` / `kori-ascii.txt`. `merge.mjs` writes the final `index.html`
at the repo root.

## Checks

`tools/verify.mjs` drives the page in headless Edge (via `playwright-core`) and
captures screenshots for the desktop, mobile, reduced-motion, and no-JS states:

```sh
node tools/verify.mjs desktop
node tools/verify.mjs mobile
node tools/verify.mjs reduced
node tools/verify.mjs nojs
```
