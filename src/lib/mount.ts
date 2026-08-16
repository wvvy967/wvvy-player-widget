import { mount as svelteMount, unmount as svelteUnmount } from 'svelte';
import App from '../App.svelte';
// `?inline` hands us the compiled Tailwind output as a string instead of letting
// Vite inject it into the document. That's the whole trick: the stylesheet has to
// land inside the shadow root, and anything Vite injects lands in <head>.
import css from '../app.css?inline';
import { resolveConfig } from './config';
import { injectFonts, resolveAssetBase } from './fonts';
import type { PlayerWidgetConfig, WidgetHandle } from '@/types';

/** Reuse one parsed stylesheet across every widget on the page. */
let sheet: CSSStyleSheet | null = null;
let patchedCss: string | null = null;

/**
 * `@property` registrations are document-scoped — a rule inside a shadow root's
 * stylesheet is ignored entirely. Tailwind v4 leans on registered `--tw-*`
 * defaults for a lot of utilities, so without this, `border-2` computes to
 * `border-style: none` (zero width), `-translate-x-1/2` does nothing, and
 * shadows and gradients quietly vanish.
 *
 * Re-declaring each registration's `initial-value` on `:host` restores the
 * defaults by ordinary inheritance, and keeps everything inside the shadow root
 * rather than injecting `@property` rules into the host document.
 */
export function withPropertyDefaults(source: string): string {
  const decls: string[] = [];
  for (const match of source.matchAll(/@property\s+(--[\w-]+)\s*\{([^}]*)\}/g)) {
    const name = match[1];
    const initial = match[2]?.match(/initial-value:\s*([^;]+)/);
    // Registrations without an initial-value have nothing to restore.
    if (name && initial?.[1]) decls.push(`${name}:${initial[1].trim()}`);
  }
  return decls.length > 0 ? `:host{${decls.join(';')}}\n${source}` : source;
}

function attachStyles(root: ShadowRoot): void {
  patchedCss ??= withPropertyDefaults(css);
  // Constructable stylesheets let N widgets share one parsed copy. Supported
  // everywhere shadow DOM matters; the <style> path covers the stragglers.
  if ('adoptedStyleSheets' in Document.prototype && typeof CSSStyleSheet !== 'undefined') {
    try {
      if (!sheet) {
        sheet = new CSSStyleSheet();
        sheet.replaceSync(patchedCss);
      }
      root.adoptedStyleSheets = [sheet];
      return;
    } catch {
      // Fall through to the <style> tag.
    }
  }
  const style = document.createElement('style');
  style.textContent = patchedCss;
  root.appendChild(style);
}

/**
 * Mount the player into `el`. The element's contents are left alone — everything
 * renders inside a shadow root attached to it.
 */
export function mountPlayer(el: HTMLElement, options: PlayerWidgetConfig = {}): WidgetHandle {
  const config = resolveConfig(options);

  if (config.fonts === 'auto') {
    injectFonts(resolveAssetBase(config.assetBase));
  }

  // Re-mounting over a live widget would leave the old one polling and holding
  // an audio element, so refuse rather than silently leaking one.
  if (el.shadowRoot && el.shadowRoot.childElementCount > 0) {
    console.warn('[wvvy-player-widget] element already has a mounted widget — call destroy() first.');
    return { destroy() {} };
  }

  const root = el.shadowRoot ?? el.attachShadow({ mode: 'open' });
  attachStyles(root);

  const app = svelteMount(App, { target: root, props: { config } });

  return {
    destroy() {
      void svelteUnmount(app);
      root.replaceChildren();
    }
  };
}
