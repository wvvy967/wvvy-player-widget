import { mount as svelteMount, unmount as svelteUnmount } from 'svelte';
import App from '../App.svelte';
// `?inline` hands us the compiled Tailwind output as a string instead of letting
// Vite inject it into the document. That's the whole trick: the stylesheet has to
// land inside the shadow root, and anything Vite injects lands in <head>.
import css from '../app.css?inline';
import { resolveConfig } from './config';
import { injectFonts, resolveAssetBase } from './fonts';
import type { PlayerWidgetConfig } from '@/types';

/** Reuse one parsed stylesheet across every widget on the page. */
let sheet: CSSStyleSheet | null = null;

function attachStyles(root: ShadowRoot): void {
  // Constructable stylesheets let N widgets share one parsed copy. Supported
  // everywhere shadow DOM matters; the <style> path covers the stragglers.
  if ('adoptedStyleSheets' in Document.prototype && typeof CSSStyleSheet !== 'undefined') {
    try {
      if (!sheet) {
        sheet = new CSSStyleSheet();
        sheet.replaceSync(css);
      }
      root.adoptedStyleSheets = [sheet];
      return;
    } catch {
      // Fall through to the <style> tag.
    }
  }
  const style = document.createElement('style');
  style.textContent = css;
  root.appendChild(style);
}

export type WidgetHandle = {
  /** Remove the widget, stop polling, and release the audio element. */
  destroy(): void;
};

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
