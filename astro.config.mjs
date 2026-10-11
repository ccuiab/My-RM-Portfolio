import { defineConfig } from 'astro/config';

// GitHub Pages project site: https://ccuiab.github.io/My-RM-Portfolio/
export default defineConfig({
  site: 'https://ccuiab.github.io',
  base: '/My-RM-Portfolio',
  trailingSlash: 'always',
  build: { format: 'directory' },
  srcDir: './src',
  publicDir: './.astro-public',
  outDir: './publish/current',
});
