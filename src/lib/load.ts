import CanvasKitInit, { type CanvasKit } from 'canvaskit-wasm'
import wasmUrl from 'canvaskit-wasm/bin/canvaskit.wasm?url'

let CanvasKitPromise: Promise<CanvasKit> | null = null

export function loadCanvasKit() {
  if (!CanvasKitPromise) {
    CanvasKitPromise = CanvasKitInit({
      locateFile: (file) =>
        import.meta.env.DEV ? wasmUrl : `https://unpkg.com/canvaskit-wasm@0.39.1/bin/${file}`,
    })
  }
  return CanvasKitPromise
}
