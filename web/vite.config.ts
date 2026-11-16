import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // No Docker com Windows ou macOS, o container não recebe os eventos de alteração de
    // arquivo da pasta montada. O polling garante o hot reload (o compose liga essa opção).
    watch: { usePolling: process.env.VITE_USE_POLLING === 'true' },
  },
})
