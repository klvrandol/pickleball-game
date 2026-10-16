import { defineConfig } from 'vite';

// Production and preview mirror the repository Pages URL; local development stays at /.
export default defineConfig(({ command, isPreview }) => ({
  base: command === 'build' || isPreview ? '/pickleball-game/' : '/',
  build: { rollupOptions: { input: { title: 'index.html', game: 'singles.html', doubles: 'doubles.html', animation: 'animation-test.html' }, output: { manualChunks: { three: ['three'] } } } },
}));
