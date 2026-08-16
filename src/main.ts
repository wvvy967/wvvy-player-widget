/**
 * Drop-in bundle entry. Built as an IIFE (`dist/player.js`) for host pages with
 * no build step:
 *
 *   <div id="wvvy-player" data-variant="card" data-frequency="96.7"></div>
 *   <script src="https://.../player.js" async></script>
 *
 * Finds every widget container on the page, reads `data-*` attributes off each,
 * and mounts. Multiple widgets with different config on one page are supported;
 * starting one stops the others so a visitor never hears two offset copies of
 * the same stream.
 */

import { mountPlayer } from './lib/mount';
import { configFromDataset } from './lib/config';
import { resolveAssetBase } from './lib/fonts';
import type { PlayerWidgetConfig, WidgetHandle } from './types';

declare const __APP_VERSION__: string;

declare global {
  interface Window {
    /** Global config merged under each element's own `data-*` attributes. */
    WvvyPlayerConfig?: PlayerWidgetConfig;
    /** Mounted widgets, in document order. Useful for `destroy()` from the console or a SPA teardown. */
    WvvyPlayer?: {
      version: string;
      widgets: WidgetHandle[];
      mount: (el: HTMLElement, options?: PlayerWidgetConfig) => WidgetHandle;
    };
  }
}

const SELECTOR = '#wvvy-player, [data-wvvy-player]';

// `document.currentScript` is only readable while the script is executing, so
// capture the asset base now — by the time DOMContentLoaded fires it's null.
const assetBase = resolveAssetBase();

function mountAll(): void {
  const els = Array.from(document.querySelectorAll<HTMLElement>(SELECTOR));
  if (els.length === 0) {
    console.warn(`[wvvy-player-widget] no container found — add <div id="wvvy-player"></div> where the player should render.`);
    return;
  }
  const widgets: WidgetHandle[] = [];
  for (const el of els) {
    // Element attributes win over the page-wide global, so one page can host a
    // shared default plus per-widget overrides.
    const options: PlayerWidgetConfig = {
      assetBase: assetBase ?? undefined,
      ...(window.WvvyPlayerConfig ?? {}),
      ...configFromDataset(el)
    };
    widgets.push(mountPlayer(el, options));
  }
  window.WvvyPlayer = {
    version: __APP_VERSION__,
    widgets,
    mount: (el, options = {}) => mountPlayer(el, { assetBase: assetBase ?? undefined, ...options })
  };
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mountAll, { once: true });
} else {
  // Script loaded async or deferred — the DOM is already there.
  mountAll();
}
