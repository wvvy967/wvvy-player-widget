# Bundled fonts

All faces here are the **latin** subsets pulled from Google Fonts and self-hosted
so the widget never makes a third-party request from a host site's page.

| File                                 | Family                | Licence |
| ------------------------------------ | --------------------- | ------- |
| `big-shoulders-stencil-latin-*.woff2` | Big Shoulders Stencil | OFL 1.1 |
| `special-elite-latin-400.woff2`       | Special Elite         | OFL 1.1 |
| `jetbrains-mono-latin-*.woff2`        | JetBrains Mono        | OFL 1.1 |

The SIL Open Font License permits redistribution and self-hosting. Keep this
notice alongside the files.

They are declared with `font-display: swap` and referenced under neutral internal
names (`WVVY Stencil`, `WVVY Elite`, `WVVY Mono`) so a host page that already
loads its own copy of these families can't collide with ours.

Fonts load only when `fonts: 'auto'` (the default). `fonts: 'none'` skips the
injection entirely and the widget falls back to system stacks.
