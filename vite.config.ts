/// <reference types="vitest/config" />

import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { svelteTesting } from '@testing-library/svelte/vite';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'path';
import { readFileSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'));
let shortSha = 'unknown';
try {
  shortSha = execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
    .toString()
    .trim();
} catch {
  // not a git checkout (e.g. tarball) — fall back
}

export default defineConfig({
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify(`${pkg.version}+${shortSha}`)
  },
  resolve: {
    alias: {
      '@': resolve(import.meta.dirname, 'src'),
      '@components': resolve(import.meta.dirname, 'src/components'),
      '@lib': resolve(import.meta.dirname, 'src/lib'),
      '@tests': resolve(import.meta.dirname, 'src/tests')
    }
  },
  plugins: [
    tailwindcss(),
    svelte(),
    svelteTesting(),
    {
      // index.html is the dev harness AND the published docs page. Rather than
      // maintain two copies, emit it at build time with the dev module script
      // swapped for the built bundle.
      name: 'emit-docs-page',
      closeBundle() {
        const html = readFileSync('index.html', 'utf-8').replace('<script type="module" src="/src/main.ts"></script>', '<script src="./player.js"></script>');
        writeFileSync('dist/index.html', html);
      }
    }
  ],
  build: {
    // Everything the widget needs must arrive in one <script src>, so no code
    // splitting and no separate CSS file — app.css is imported with `?inline`
    // and travels inside the bundle to be adopted by the shadow root.
    cssCodeSplit: false,
    minify: 'oxc',
    rolldownOptions: {
      input: 'src/main.ts',
      output: {
        entryFileNames: 'player.js',
        format: 'iife',
        name: 'WvvyPlayerWidget',
        codeSplitting: false
      },
      checks: {
        pluginTimings: false
      }
    }
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/tests/unit/setup.ts',
    include: ['src/tests/unit/**/*.{test,spec}.{js,ts}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'cobertura'],
      include: ['src/lib/**/*.ts', 'src/components/**/*.svelte', 'src/App.svelte'],
      exclude: ['src/tests/**', 'src/main.ts'],
      thresholds: {
        lines: 80,
        functions: 80,
        statements: 80,
        branches: 70
      }
    }
  }
});
