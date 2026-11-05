import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  // @arlecchino/suite-ui is a linked local package shipping TypeScript source; resolve its imports (React, fonts) from this app.
  resolve: { preserveSymlinks: true, dedupe: ['react', 'react-dom'] },
  server: { host: 'localhost', port: 1421, strictPort: true, watch: { ignored: ['**/src-tauri/**'] } },
  build: { target: ['es2022', 'safari15'] },
});
