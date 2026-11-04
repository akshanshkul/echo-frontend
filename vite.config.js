import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: true, // listen on all network interfaces (reachable by IP)
    port: 5173,
    proxy: {
      // xfwd: pass the real client IP (X-Forwarded-For) so the API's rate limits are per person, not per proxy
      '/api': { target: process.env.VITE_PROXY_TARGET || 'http://localhost:4000', xfwd: true },
      '/socket.io': {
        target: process.env.VITE_PROXY_TARGET || 'http://localhost:4000',
        ws: true,
        xfwd: true,
      },
    },
  },
});
