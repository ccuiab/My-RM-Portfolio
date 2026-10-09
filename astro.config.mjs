import { defineConfig } from 'astro/config';

// GitHub Pages project site: https://ccuiab.github.io/My-RM-Portfolio/
export default defineConfig({
  site: 'https://ccuiab.github.io',
  base: '/My-RM-Portfolio',
  trailingSlash: 'always',
  build: { format: 'directory' },
  // docs/ is the legacy hand-written site; keep it out of the Astro build
  srcDir: './src',
  publicDir: './public',
  outDir: './dist',
});
