import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base './' keeps asset URLs relative, so the build works on GitHub Pages
// under any repository name (routing uses the URL hash).
export default defineConfig({
  base: './',
  plugins: [react()],
});
