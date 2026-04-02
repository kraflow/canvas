import CanvasKitInit, { type CanvasKit } from 'canvaskit-wasm'
import wasmUrl from 'canvaskit-wasm/bin/canvaskit.wasm?url'
import { IS_DEV } from '../constants'

let CanvasKitPromise: Promise<CanvasKit> | null = null

/**
 * Loads CanvasKit WASM module.
 * If `IS_DEV` is true, it loads from the local file system.
 * Otherwise, it loads from the unpkg CDN.
 * @returns {Promise<CanvasKit>} A promise that resolves to the loaded CanvasKit module.
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
