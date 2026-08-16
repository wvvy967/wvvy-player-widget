import { describe, it, expect } from 'vitest';
import { withPropertyDefaults } from '@lib/mount';

// Note: `app.css?inline` resolves to an empty string under vitest — the Tailwind
// Vite plugin doesn't compile CSS in that transform pipeline — so these exercise
// the transform directly rather than the real stylesheet.

// Regression guard for the sharpest edge of rendering Tailwind inside a shadow
// root: `@property` registrations are document-scoped, so a rule sitting in the
// shadow stylesheet is ignored outright. Every utility that leans on a
// registered `--tw-*` default then computes to nothing — `border-2` becomes
// `border-style: none` with zero width, `-translate-x-1/2` stops translating.
// The failure is silent: the widget renders borderless and subtly misaligned
// rather than throwing, so only a test keeps it fixed.

describe('withPropertyDefaults', () => {
  it('hoists every @property initial-value onto :host', () => {
    const out = withPropertyDefaults(`
      @property --tw-border-style { syntax: "*"; inherits: false; initial-value: solid; }
      @property --tw-scale-x { syntax: "*"; inherits: false; initial-value: 1; }
      .border-2 { border-style: var(--tw-border-style); border-width: 2px; }
    `);
    expect(out).toMatch(/^:host\{[^}]*--tw-border-style:solid/);
    expect(out).toContain('--tw-scale-x:1');
  });

  it('skips registrations that declare no initial value', () => {
    const out = withPropertyDefaults('@property --tw-thing { syntax: "*"; inherits: false; }');
    expect(out).not.toContain(':host{');
  });

  it('leaves CSS without @property rules untouched', () => {
    const plain = '.a{color:red}';
    expect(withPropertyDefaults(plain)).toBe(plain);
  });

  it('preserves the original stylesheet after the injected block', () => {
    const out = withPropertyDefaults('@property --tw-x { initial-value: 0; } .a{color:red}');
    expect(out).toContain('.a{color:red}');
  });

  // Matches how Tailwind actually emits these in a production build: minified,
  // no whitespace between the name and the block.
  it('handles the minified form Tailwind emits', () => {
    const out = withPropertyDefaults('@property --tw-border-style{syntax:"*";inherits:false;initial-value:solid}.a{border-style:var(--tw-border-style)}');
    expect(out).toMatch(/^:host\{--tw-border-style:solid\}/);
  });
});
