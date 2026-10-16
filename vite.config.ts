import { defineConfig } from 'vite';

// Relative asset URLs work on GitHub Pages and when hosted in a subdirectory.
export default defineConfig({
  base: './',
  build: { rollupOptions: { input: { title: 'index.html', game: 'singles.html', doubles: 'doubles.html', animation: 'animation-test.html' }, output: { manualChunks: { three: ['three'] } } } },
});
