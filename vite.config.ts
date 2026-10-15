import { defineConfig } from 'vite';

// Relative asset URLs work on GitHub Pages and when hosted in a subdirectory.
export default defineConfig({
  base: './',
  build: { rollupOptions: { output: { manualChunks: { three: ['three'] } } } },
});
