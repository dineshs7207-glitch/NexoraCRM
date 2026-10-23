import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // GitHub Pages serves this project below /NexoraCRM; local development stays at /.
  base: process.env.GITHUB_PAGES === 'true' ? '/NexoraCRM/' : '/',
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          if (id.includes('@mui/') || id.includes('@emotion/')) return 'ui-vendor';
          if (id.includes('recharts') || id.includes('/d3-')) return 'charts-vendor';
          if (id.includes('@supabase/') || id.includes('@tanstack/')) return 'data-vendor';
        },
      },
    },
  },
});
