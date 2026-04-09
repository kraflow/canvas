import type { Yoga } from 'yoga-layout/load'
import { IS_DEV } from '../constants'

let YogaPromise: Promise<Yoga> | null = null

function setYogaPromise(promise: Promise<Yoga>): void {
  YogaPromise = promise
}

/**
 * Loads the Yoga layout WASM module.
 * The promise is cached, so subsequent calls will return the same promise.
 * In development mode, the module is loaded from the bundled package.
 * In production mode, the WASM module is loaded from a CDN URL.
 */
export async function loadYoga(): Promise<Yoga> {
  if (!YogaPromise) {
    if (IS_DEV) {
      // Use bundled yoga-layout in development
      const mod = await import(/* @vite-ignore */ 'yoga-layout/load')
      const promise = mod.loadYoga()
      setYogaPromise(promise)
    } else {
      // Use CDN in production for smaller bundle size
      // Using new Function to hide import from bundler
      const dynamicImport = new Function('specifier', 'return import(specifier)')
      const mod = await dynamicImport('https://cdn.jsdelivr.net/npm/yoga-layout@3.2.1/+esm')
      const promise = mod.loadYoga()
      setYogaPromise(promise)
    }
  }
  return YogaPromise as Promise<Yoga>
}
