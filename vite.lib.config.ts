/// <reference types="vitest/config" />

import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import tailwindcss from '@tailwindcss/vite';
import dts from 'unplugin-dts/vite';
import { resolve } from 'path';
import { readFileSync } from 'fs';
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

// ESM build for npm consumers. Same source as the IIFE bundle; the difference is
// that this one exports mountPlayerWidget instead of auto-mounting, and ships
// .d.ts alongside.
export default defineConfig({
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
  // vite-env.d.ts is in the dts scope so the `*.css?inline` module declaration
  // it pulls in from vite/client is visible when types are rolled up.
  plugins: [tailwindcss(), svelte(), dts({ include: ['src/module.ts', 'src/types/index.ts', 'src/vite-env.d.ts'], outDir: 'dist', rollupTypes: true })],
  build: {
    lib: {
      entry: resolve(import.meta.dirname, 'src/module.ts'),
      formats: ['es'],
      fileName: 'module'
    },
    cssCodeSplit: false,
    minify: 'oxc',
    outDir: 'dist',
    // The demo site build runs first and writes dist/player.js — don't wipe it.
    emptyOutDir: false
  }
});
