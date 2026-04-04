import CanvasKitInit, { type CanvasKit } from 'canvaskit-wasm'
import wasmUrl from 'canvaskit-wasm/bin/canvaskit.wasm?url'
import { IS_DEV } from '../constants'

let CanvasKitPromise: Promise<CanvasKit> | null = null

/**
 * Loads the CanvasKit WASM module and returns a promise that resolves to the CanvasKit instance.
 * The promise is cached, so subsequent calls will return the same promise.
 * In development mode, the WASM module is loaded from a local URL.
 * In production mode, the WASM module is loaded from a CDN URL.
 */
export async function loadCanvasKit(): Promise<CanvasKit> {
  if (!CanvasKitPromise) {
    CanvasKitPromise = CanvasKitInit({
      locateFile: (file) =>
        IS_DEV ? wasmUrl : `https://unpkg.com/canvaskit-wasm@0.39.1/bin/${file}`,
    })
  }
  return CanvasKitPromise
}
