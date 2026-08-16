/**
 * WVVY Player Widget — embeddable live-radio player for any AzuraCast station.
 *
 * This is the ESM entry point for npm consumers. It exports
 * {@link mountPlayerWidget}, which mounts the player into a host element, plus
 * the public {@link PlayerWidgetConfig} type.
 *
 * For drop-in HTML embeds with no bundler, use the prebuilt IIFE bundle
 * (`dist/player.js`) instead — it finds `#wvvy-player` (and any
 * `[data-wvvy-player]` element) and reads configuration from `data-*` attributes.
 *
 * Everything renders inside a shadow root, so the host page's CSS cannot reach
 * the widget and the widget's CSS cannot reach the host page. Theming is done
 * through the documented `--wvvy-*` custom properties, which do cross that
 * boundary by design.
 *
 * @example
 * ```ts
 * import { mountPlayerWidget } from 'wvvy-player-widget';
 *
 * const widget = mountPlayerWidget(document.getElementById('player')!, {
 *   station: 'https://radio.wvvy.org',
 *   shortcode: 'wvvy',
 *   variant: 'card',
 *   theme: 'brutalist',
 *   frequency: '96.7'
 * });
 *
 * // later
 * widget.destroy();
 * ```
 *
 * @packageDocumentation
 */

import { mountPlayer } from './lib/mount';
import type { PlayerWidgetConfig, Variant, Theme, FontMode, WidgetHandle } from './types';

export type { PlayerWidgetConfig, Variant, Theme, FontMode, WidgetHandle };

/**
 * Default location for the widget's own assets (the self-hosted fonts), resolved
 * relative to this module. Only correct when the ESM build is served as-is —
 * once a bundler inlines it, this points at the host app's output directory, so
 * bundler consumers should pass an explicit `assetBase` or `fonts: 'none'`.
 *
 * `import.meta` lives here rather than in the shared fonts module because it is
 * invalid syntax in the IIFE bundle, which resolves its base from the script tag.
 */
const moduleAssetBase: string | undefined = (() => {
  try {
    // Resolving at runtime is the point — Vite must not try to rewrite this to a
    // build-time asset path.
    return new URL(/* @vite-ignore */ '.', import.meta.url).href.replace(/\/+$/, '');
  } catch {
    return undefined;
  }
})();

/**
 * Mount the player widget into the given element.
 *
 * The element is used only as a shadow host — its existing children are left
 * untouched (though they will no longer render, since a shadow root replaces
 * light-DOM rendering).
 *
 * @param el - Host element to render into.
 * @param options - Configuration; see {@link PlayerWidgetConfig}. Defaults to WVVY 96.7.
 * @returns A handle whose `destroy()` stops polling, releases the audio element, and clears the shadow root.
 */
export function mountPlayerWidget(el: HTMLElement, options: PlayerWidgetConfig = {}): WidgetHandle {
  return mountPlayer(el, { assetBase: moduleAssetBase, ...options });
}
