import { defineConfig } from 'vite';

export default defineConfig({
  base: './', // Required for itch.io
  server: {
    host: '127.0.0.1', // Match Live Server's local IP
    port: 5500,        // Match Live Server's exact port
    strictPort: true,  // Force this port so your save data loads
    open: true         // Automatically open the browser for you!
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  }
});