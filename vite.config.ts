import path from "path"
import react from '@vitejs/plugin-react-swc'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  server: { host: 'localhost', hmr: { host: 'localhost' } },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined

          if (id.includes('@fullcalendar')) return 'calendar'
          if (id.includes('@tiptap') || id.includes('tiptap')) return 'tiptap'
          if (id.includes('lucide-react')) return 'icons'
          if (id.includes('react-router-dom')) return 'router'
          if (id.includes('react-dom')) return 'react-dom'
          if (id.includes('/react/') || id.includes('react/jsx-runtime') || id.includes('react/index.js')) return 'react'
          if (id.includes('date-fns')) return 'date-fns'
          if (id.includes('clsx')) return 'clsx'
          if (id.includes('class-variance-authority')) return 'cva'
          if (id.includes('tailwind-merge')) return 'tailwind-merge'

          return 'vendor'
        }
      }
    }
  }
})
