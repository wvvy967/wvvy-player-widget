# Changelog

All notable changes to this project are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and
this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Initial release. Embeddable live-radio player for any AzuraCast station.
- Two variants: `bar` (single strip) and `card` (dial, transport, now playing, schedule).
- Two themes: `brutalist` (wvvy.org house style) and `modern` (navy/amber card), each with an `accent` override and `--wvvy-*` custom properties for host theming.
- Shadow DOM isolation — host page CSS cannot reach the widget, and the widget's CSS cannot leak out.
- OS media-session integration: lock screen, notification shade, and CarPlay transport with live track metadata.
- Drop-in IIFE bundle (`dist/player.js`) configured through `data-*` attributes, plus an ESM entry (`dist/module.js`) exporting `mountPlayerWidget` for npm consumers.
- Iframe fallback page (`dist/embed.html`) for site builders that strip `<script>`, with a `wvvy-player:height` postMessage for self-sizing hosts.
- Self-hosted woff2 font subsets — no third-party requests from a host site's page. `fonts: 'none'` opts out entirely.
- Multiple widgets per page, with mutual exclusion so only one stream is ever audible.
- Polling that pauses on tab hide and when scrolled out of view, with a 10s interval floor and no request stacking.
- Reconnect with exponential backoff, giving up after ~35s with an "off air" explanation rather than spinning indefinitely.
- Container-query layout, so the widget responds to its container rather than the viewport.
