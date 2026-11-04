import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: { host: 'localhost', port: 1421, strictPort: true, watch: { ignored: ['**/src-tauri/**'] } },
  build: { target: ['es2022', 'safari15'] },
});
