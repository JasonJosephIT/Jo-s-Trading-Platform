import path from 'node:path'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import { viteSingleFile } from 'vite-plugin-singlefile'

// Builds one self-contained file. scripts/publish.mjs copies it to ../setup.html.
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss(), viteSingleFile()],
  resolve: { alias: { '@': path.resolve(__dirname, './src'), '@catalog': path.resolve(__dirname, '../catalog'), '@prompts': path.resolve(__dirname, '../prompts') } },
  build: { outDir: 'dist', assetsInlineLimit: 100000000 },
})
