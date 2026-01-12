import path from 'path';
import react from '@vitejs/plugin-react-swc';
import { defineConfig } from 'vite';
import { visualizer } from 'rollup-plugin-visualizer';

// https://vite.dev/config/
export default defineConfig({
  server: {
    host: 'localhost',
    hmr: { host: 'localhost' },
    // Allow the sandboxed landing iframe (origin 'null') to load dev assets during local testing
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
    proxy: {
      // Ensure client-side routing works
    }
  },
  optimizeDeps: {
    // Exclude packages that cause the dep optimizer to mis-handle ESM/CJS resolution
    exclude: ['date-fns'],
  },
  plugins: [
    react(),
    ...(process.env.ANALYZE === 'true'
      ? [
        visualizer({
          filename: 'dist/bundle-analysis.html',
          open: false,
          gzipSize: true,
          brotliSize: true,
        }),
      ]
      : []),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;

          if (id.includes('@fullcalendar')) return 'calendar';
          if (id.includes('@tiptap') || id.includes('tiptap')) return 'tiptap';
          if (id.includes('lucide-react')) return 'icons';
          if (id.includes('react-router-dom')) return 'router';
          if (id.includes('react-dom')) return 'react-dom';
          if (
            id.includes('/react/') ||
            id.includes('react/jsx-runtime') ||
            id.includes('react/index.js')
          )
            return 'react';
          if (id.includes('date-fns')) return 'date-fns';
          if (id.includes('clsx')) return 'clsx';
          if (id.includes('class-variance-authority')) return 'cva';
          if (id.includes('tailwind-merge')) return 'tailwind-merge';

          // Split Supabase sub-packages into finer chunks
          if (id.includes('@supabase/auth-js')) return 'supabase-auth';
          if (id.includes('realtime-js')) return 'supabase-realtime';
          if (id.includes('postgrest-js')) return 'supabase-postgrest';
          if (id.includes('storage-js')) return 'supabase-storage';
          if (id.includes('@supabase')) return 'supabase';

          return 'vendor';
        },
      },
    },
  },
});
