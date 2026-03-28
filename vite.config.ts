import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

import dts from 'vite-plugin-dts'
import path from 'node:path'

import pkg from './package.json'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    vueDevTools(),
    dts({
      entryRoot: 'src',
      include: ['src'],
      exclude: ['src/**/__tests__/*', 'src/**/*.vue'],
      tsconfigPath: './tsconfig.app.json',
      rollupTypes: true,
      insertTypesEntry: true,
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  define: {
    __VERSION__: "'" + pkg.version + "'",
  },
  build: {
    lib: {
      entry: path.resolve(__dirname, 'src/index.ts'),
      name: 'Canvas',
      fileName: (format) => `canvas.${format}.js`,
    },
  },
})
