import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In development Quarkus (Quinoa) serves this app on :8080 and proxies to Vite.
// Running Vite alone, /api goes to the Quarkus dev server.
export default defineConfig({
  plugins: [react()],
  server: { port: 5178, strictPort: true, proxy: { '/api': 'http://localhost:8080' } },
});
