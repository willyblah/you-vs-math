import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    rollupOptions: { output: { manualChunks: { phaser: ['phaser'] } } },
    // Phaser's renderer and physics ship together as the game's engine chunk.
    chunkSizeWarningLimit: 1500,
  },
});
