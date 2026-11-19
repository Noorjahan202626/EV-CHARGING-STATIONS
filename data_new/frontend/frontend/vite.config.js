import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174, // Forces Vite to run on this specific port
    strictPort: true, // Fail instead of silently switching ports
    proxy: {
      // Forwards any request starting with /api to your backend
      '/api': {
        target: 'http://127.0.0.1:5000', // IPv4 on purpose: avoids localhost -> ::1 timeouts
        changeOrigin: true,
        secure: false,
        timeout: 15000, // client -> proxy timeout (ms)
        proxyTimeout: 15000, // proxy -> backend timeout (ms)
        configure: (proxy) => {
          proxy.on('error', (err, req) => {
            console.log(`[proxy error] ${req.url} -> ${err.code || err.message}`);
          });
        },
      },
    },
  },
});