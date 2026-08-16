<h1 align="center">WVVY Player Widget</h1>

<p align="center">
  An embeddable live-radio player for any <a href="https://www.azuracast.com/">AzuraCast</a> station.<br>
  One script tag. No iframe. No dependencies. ~29 kB gzipped.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/wvvy-player-widget"><img src="https://img.shields.io/npm/v/wvvy-player-widget" alt="npm"></a>
  <a href="https://github.com/wvvy967/wvvy-player-widget/actions/workflows/main.yml"><img src="https://github.com/wvvy967/wvvy-player-widget/actions/workflows/main.yml/badge.svg" alt="main"></a>
  <a href="./LICENSE"><img src="https://img.shields.io/npm/l/wvvy-player-widget" alt="MIT"></a>
</p>

<p align="center">
  <strong>👉 Live demo and snippet builder:</strong> <a href="https://wvvy.org/widget/">wvvy.org/widget</a>
</p>

Built for [WVVY 96.7 LPFM](https://wvvy.org), Martha's Vineyard community radio — but the station is just a default. Point it at any AzuraCast install.

## Quick start

Paste this where the player should appear:

```html
<div id="wvvy-player" data-variant="bar" data-frequency="96.7"></div>
<script src="https://wvvy.org/widget/player.js" async></script>
```

For another station, point it at that install:

```html
<div
  id="wvvy-player"
  data-station="https://radio.example.org"
  data-shortcode="mystation"
  data-variant="card"
  data-theme="modern"
></div>
<script src="https://wvvy.org/widget/player.js" async></script>
```

## Why not an iframe?

Two reasons that matter for a *player* specifically:

- **Lock-screen controls.** Browsers bind `navigator.mediaSession` — the lock screen, notification shade, and CarPlay transport — to the **top-level** document. From a cross-origin iframe, none of it surfaces. Running in the host page means play/pause and track metadata reach the OS.
- **No height handshake.** No fixed `height="120"`, no `postMessage` resize dance. The widget sizes to whatever container it's dropped in, using container queries rather than viewport ones.

The usual argument *for* iframes is CSS isolation. That's covered here by rendering into a **shadow root**, which is stricter than an iframe in one direction: host page CSS cannot reach in, and the widget's CSS cannot leak out. Theming goes through documented custom properties, which are the one channel deliberately left open.

An [iframe fallback](#iframe-fallback) still ships for site builders that strip `<script>`.

## Variants

| Variant | Shape                                                                          |
| ------- | ------------------------------------------------------------------------------ |
| `bar`   | Single strip — play button, status line, current track, optional link.          |
| `card`  | Full console — FM dial, transport, volume, now playing, today's schedule.       |

## Themes

| Theme       | Look                                                                     |
| ----------- | ------------------------------------------------------------------------ |
| `brutalist` | wvvy.org's house style: ink black, lime accent, square corners, stencil. |
| `modern`    | Softer dark card: navy ground, amber accent, rounded corners, system sans. |

Both accept an `accent` override, so `modern` + your brand colour is usually the fastest route to something that looks intentional on someone else's site.

## Options

Every option is a `data-*` attribute on the container, or a key on the config object passed to `mountPlayerWidget`.

| Attribute            | Default                    | What it does                                                              |
| -------------------- | -------------------------- | ------------------------------------------------------------------------- |
| `data-station`       | `https://radio.wvvy.org`   | Base URL of the AzuraCast install.                                        |
| `data-shortcode`     | `wvvy`                     | Station shortcode within that install.                                    |
| `data-variant`       | `bar`                      | `bar` or `card`.                                                          |
| `data-theme`         | `brutalist`                | `brutalist` or `modern`.                                                  |
| `data-accent`        | theme default              | Any CSS colour. Drives play button, on-air dot, EQ, dial needle.          |
| `data-stream`        | from API                   | Explicit stream URL. Defaults to the station's own default mount.         |
| `data-name`          | from API                   | Station name — card header and bar status strip.                          |
| `data-tagline`       | from API                   | Headline beside the card's play button.                                   |
| `data-description`   | from API                   | Small line under that headline.                                           |
| `data-location`      | —                          | Location line under the card header.                                      |
| `data-frequency`     | —                          | e.g. `96.7`. Also places the dial needle.                                 |
| `data-link`          | —                          | Outbound link URL. Omit to hide the button.                               |
| `data-link-label`    | `Full player and schedule →` | Label for that link.                                                    |
| `data-show-dial`     | `true`                     | FM dial on the card. Requires `data-frequency`.                           |
| `data-show-schedule` | `true`                     | Today's schedule strip. Hides itself if the station publishes none.       |
| `data-show-listeners`| `false`                    | Live listener count. Off by default; hides itself anyway if unpublished.  |
| `data-show-volume`   | `true`                     | Volume slider. Always hidden on iOS.                                      |
| `data-poll-interval` | `20`                       | Metadata poll seconds. Floor of 10.                                       |
| `data-fonts`         | `auto`                     | `auto` self-hosts the web fonts; `none` uses system fonts, zero requests. |

Unknown or malformed values log a warning and fall back to the default rather than failing to render. `station`, `stream`, and `link` accept only `http(s)` URLs — a `javascript:` URL in host-page markup is rejected.

## Theming

Set custom properties on the container. They cross the shadow boundary by design:

```css
#wvvy-player {
  --wvvy-accent: #f0a500;
  --wvvy-bg: #101820;
  --wvvy-panel: #18222c;
  --wvvy-raised: #22303c;
  --wvvy-text: #eef2f7;
  --wvvy-muted: #8fa0b3;
  --wvvy-line: #2c3a4b;
  --wvvy-live: #c4452f;
  --wvvy-warn: #f0a500;
}
```

## npm

```bash
npm install wvvy-player-widget
```

```ts
import { mountPlayerWidget } from 'wvvy-player-widget';

const widget = mountPlayerWidget(document.getElementById('player')!, {
  station: 'https://radio.wvvy.org',
  shortcode: 'wvvy',
  variant: 'card',
  frequency: '96.7'
});

// on teardown
widget.destroy();
```

Bundler builds can't auto-detect where the fonts are served from. Either set `assetBase` to the URL you host `dist/fonts/` at, or pass `fonts: 'none'` and let the system stacks take over.

## Iframe fallback

Squarespace, Wix, and Google Sites strip `<script>` from user content on some plans. If yours does:

```html
<iframe src="https://wvvy.org/widget/embed.html?variant=bar&frequency=96.7"
        width="100%" height="104" style="border:0" title="WVVY 96.7 live"></iframe>
```

It loads the same bundle and takes the same options as query parameters. The page posts a `wvvy-player:height` message to the parent for hosts that want to self-size. What you give up is lock-screen and CarPlay controls — see [above](#why-not-an-iframe).

## Behaviour worth knowing

- **Multiple widgets per page are fine.** Starting one stops the others, so nobody hears two offset copies of the same stream.
- **Polling is conservative.** It pauses while the tab is hidden and while the widget is scrolled out of view, never runs faster than a 10s floor, and never stacks requests. This runs on someone else's page against someone else's server.
- **The metadata feed failing never claims the stream is dead.** A hiccup marks the data stale and keeps the last known track; play stays available throughout.
- **Dropped streams reconnect with backoff** (~35s across six attempts), then stop and say the station appears to be off air rather than spinning forever.
- **No cookies, no analytics, no third-party requests.** Only the station's own API and audio mount. Fonts are self-hosted alongside the bundle — the widget never calls Google Fonts from a visitor's browser.

## Development

```bash
npm install
npm run dev      # demo + snippet builder at localhost:5173
npm run all      # format → lint → test → build
```

`npm run build` emits:

| File               | What it is                                       |
| ------------------ | ------------------------------------------------ |
| `dist/player.js`   | IIFE drop-in bundle, auto-mounts from `data-*`.   |
| `dist/module.js`   | ESM entry for npm consumers, plus `module.d.ts`.  |
| `dist/index.html`  | Demo and snippet builder.                         |
| `dist/embed.html`  | Iframe fallback page.                             |
| `dist/fonts/`      | Self-hosted woff2 subsets (OFL 1.1).              |

### One sharp edge

Tailwind's `@property` registrations are **document-scoped** — a rule inside a shadow root's stylesheet is ignored outright. Without a workaround, `border-2` computes to `border-style: none`, `-translate-x-1/2` stops translating, and shadows silently vanish. `src/lib/mount.ts` hoists every registration's `initial-value` onto `:host`, where ordinary inheritance restores it. `src/tests/unit/shadow-css.test.ts` guards it, because the failure mode is silent rather than loud.

## Licence

MIT. Bundled fonts are OFL 1.1 — see [`public/fonts/README.md`](./public/fonts/README.md).
