# Changelog

All notable changes to this project are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and
this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.0] - 2026-08-16

### Added

- `data-schedule-url` / `scheduleUrl` — fetch the card's schedule from any URL returning AzuraCast's schedule JSON, instead of the station's own `/api/station/{shortcode}/schedule`. For stations whose schedule lives outside AzuraCast, this keeps all the station-specific knowledge in the endpoint rather than in the widget. WVVY's schedule is a Google Sheet republished in that shape by `https://wvvy.org/api/schedule`.

### Fixed

- The presenter never rendered against a real AzuraCast install. `parseSchedule` read a `streamer` field, which AzuraCast's schedule entries don't have — the presenter is encoded in `description` as `"Streamer: <name>"`. That's now the primary source, with `streamer` kept as a fallback for feeds that do provide it.
- A presenter identical to the entry name is dropped rather than rendered twice. AzuraCast names streamer-type entries after the streamer, so the strip read `DJ WolfDen · DJ WolfDen`.

## [0.1.1] - 2026-08-16

### Changed

- Narrowed the published npm package to what bundler consumers actually need: `dist/module.js`, its type declarations, and `dist/fonts/`. The demo page (`dist/index.html`), the drop-in CDN bundle (`dist/player.js`), and the iframe fallback (`dist/embed.html`) are no longer shipped to npm — those are served from [wvvy.org/widget/](https://wvvy.org/widget/). Packed 200.4 → 166.4 kB, unpacked 361.8 → 256.7 kB, 15 → 12 files.

  `dist/fonts/` deliberately stays: consumers who point `assetBase` at their own copy need the woff2 files (and the OFL notice alongside them). `dist/types/` stays because `module.d.ts` imports `./types` — dropping it would ship declarations that fail to resolve.

  No runtime change. Anyone loading `player.js` from the CDN is unaffected.

## [0.1.0] - 2026-08-16

First release. Published to npm as [`wvvy-player-widget`](https://www.npmjs.com/package/wvvy-player-widget)
and served from [wvvy.org/widget/](https://wvvy.org/widget/).

### Added

- Embeddable live-radio player for any AzuraCast station — `data-station` / `data-shortcode` point it at any install, with WVVY 96.7 LPFM as the default.
- Two variants: `bar` (single strip) and `card` (dial, transport, now playing, today's schedule).
- Two themes: `brutalist` (wvvy.org house style) and `modern` (navy/amber card), each with an `accent` override and `--wvvy-*` custom properties for host theming.
- Shadow DOM isolation — host page CSS cannot reach the widget, and the widget's CSS cannot leak out. Theming crosses that boundary only through the documented custom properties.
- OS media-session integration: lock screen, notification shade, and CarPlay transport with live track metadata. This is why the widget runs in the host page rather than an iframe — browsers bind media controls to the top-level document.
- Drop-in IIFE bundle (`dist/player.js`) configured through `data-*` attributes, plus an ESM entry (`dist/module.js`) exporting `mountPlayerWidget` with rolled-up types.
- Iframe fallback page (`dist/embed.html`) for site builders that strip `<script>`, taking the same options as query parameters and posting a `wvvy-player:height` message for self-sizing hosts.
- Self-hosted woff2 font subsets (OFL 1.1) — the widget never calls Google Fonts from a visitor's browser. `fonts: 'none'` opts out entirely.
- Multiple widgets per page, with mutual exclusion so only one stream is ever audible.
- Polling that pauses on tab hide and when scrolled out of view, with a 10s interval floor and no request stacking.
- Reconnect with exponential backoff, giving up after ~35s with an "off air" explanation rather than spinning indefinitely.
- Container-query layout, so the widget responds to its container rather than the viewport.
- Config validation: unknown enum values warn and fall back rather than failing to render; `station`/`stream`/`link` accept only `http(s)` URLs, and `accent` rejects the punctuation needed to break out of a style attribute.

### Fixed

Caught during initial development, recorded because each failure mode is silent
and could easily regress:

- Tailwind's `@property` registrations are document-scoped and are ignored inside a shadow root, which made `border-2` compute to `border-style: none` and `-translate-x-1/2` stop translating. Their `initial-value`s are now hoisted onto `:host`.
- `DOMException` is not reliably `instanceof Error` across engines, so a browser autoplay block was misclassified and sent into the reconnect backoff instead of being treated as terminal.
- Album art that 404s (AzuraCast reports art URLs for tracks whose media is missing) now falls back to the placeholder instead of rendering a broken-image icon.
- Truncated display text was clipped by the brutalist theme's `line-height: 0.85`.

[unreleased]: https://github.com/wvvy967/wvvy-player-widget/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/wvvy967/wvvy-player-widget/compare/v0.1.1...v0.2.0
[0.1.1]: https://github.com/wvvy967/wvvy-player-widget/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/wvvy967/wvvy-player-widget/releases/tag/v0.1.0
