import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://travel.cloudborne.cn',
  trailingSlash: 'always',
  build: { format: 'directory', inlineStylesheets: 'auto' },
  compressHTML: true,
  devToolbar: { enabled: false },
});
