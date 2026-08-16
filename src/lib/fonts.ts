/**
 * Web font loading for a Shadow DOM widget.
 *
 * `@font-face` declared inside a shadow root is ignored — font faces resolve
 * against the document, not the shadow tree. So the rules have to be injected
 * into the host document's <head> even though every rule that *uses* them lives
 * inside our shadow root.
 *
 * Fonts are self-hosted alongside the bundle rather than pulled from Google.
 * Injecting a third-party font request into someone else's page is both a
 * privacy problem for their visitors and a CSP problem for them. `fonts: 'none'`
 * skips this entirely and falls back to the system stacks in app.css.
 */

const STYLE_ID = 'wvvy-player-widget-fonts';

type FaceSpec = { family: string; file: string; weight: string; style?: string };

// Brutalist theme uses the stencil + typewriter pair from wvvy.org; both themes
// share the mono. The modern theme's headings intentionally use system-ui, which
// costs nothing to load and reads correctly on every platform.
const FACES: FaceSpec[] = [
  { family: 'WVVY Stencil', file: 'big-shoulders-stencil-latin-700', weight: '700' },
  { family: 'WVVY Stencil', file: 'big-shoulders-stencil-latin-900', weight: '900' },
  { family: 'WVVY Elite', file: 'special-elite-latin-400', weight: '400' },
  { family: 'WVVY Mono', file: 'jetbrains-mono-latin-400', weight: '400' },
  { family: 'WVVY Mono', file: 'jetbrains-mono-latin-700', weight: '700' }
];

/**
 * Where the widget's own assets live. Derived from the executing script's URL so
 * the bundle works from any CDN path without configuration, with an explicit
 * `assetBase` override for bundler consumers where the script URL is the host
 * app's, not ours.
 */
export function resolveAssetBase(explicit?: string): string | null {
  if (explicit) return explicit.replace(/\/+$/, '');
  if (typeof document !== 'undefined') {
    const current = document.currentScript as HTMLScriptElement | null;
    if (current?.src) return current.src.replace(/\/[^/]*$/, '');
  }
  try {
    // ESM builds: resolve relative to this module.
    return new URL('.', import.meta.url).href.replace(/\/+$/, '');
  } catch {
    return null;
  }
}

export function injectFonts(assetBase: string | null): void {
  if (typeof document === 'undefined' || !assetBase) return;
  if (document.getElementById(STYLE_ID)) return; // already injected by another instance

  const rules = FACES.map(
    (f) => `@font-face{font-family:'${f.family}';font-style:${f.style ?? 'normal'};font-weight:${f.weight};font-display:swap;src:url('${assetBase}/fonts/${f.file}.woff2') format('woff2');}`
  ).join('');

  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = rules;
  document.head.appendChild(style);
}
