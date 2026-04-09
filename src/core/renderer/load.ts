import type { CanvasKit } from 'canvaskit-wasm'
import wasmUrl from 'canvaskit-wasm/bin/canvaskit.wasm?url'
import { IS_DEV } from '../constants'

let CanvasKitPromise: Promise<CanvasKit> | null = null

/**
 * Loads the CanvasKit WASM module and returns a promise that resolves to the CanvasKit instance.
 * The promise is cached, so subsequent calls will return the same promise.
 * In development mode, the module is loaded from the bundled package.
 * In production mode, the module is loaded from a CDN URL.
 */
export async function loadCanvasKit(): Promise<CanvasKit> {
  if (!CanvasKitPromise) {
    if (IS_DEV) {
      // Use bundled canvaskit-wasm in development
      const { default: CanvasKitInit } = await import(/* @vite-ignore */ 'canvaskit-wasm')
      const promise = CanvasKitInit({
        locateFile: () => wasmUrl,
      })
      CanvasKitPromise = promise
    } else {
      // Use CDN in production for smaller bundle size
      // Using new Function to hide import from bundler
      const dynamicImport = new Function('specifier', 'return import(specifier)')
      const mod = await dynamicImport('https://cdn.jsdelivr.net/npm/canvaskit-wasm@0.39.1/+esm')
      const CanvasKitInit = mod.default
      const promise = CanvasKitInit({
        locateFile: (file: string) => `https://unpkg.com/canvaskit-wasm@0.39.1/bin/${file}`,
      })
      CanvasKitPromise = promise
    }
  }
  return CanvasKitPromise as Promise<CanvasKit>
}
