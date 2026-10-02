import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  // relative paths so the build works under the GitHub Pages subpath
  base: './',
})
