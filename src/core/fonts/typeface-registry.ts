import type { CanvasKit, Typeface } from 'canvaskit-wasm'
import type { FontStore } from './font-store'

export interface TypefaceRegistry {
  register(key: string): Typeface | undefined
  get(key: string): Typeface | undefined
  dispose(): void
}

export function createTypefaceRegistry(ck: CanvasKit, store: FontStore): TypefaceRegistry {
  const typefaces = new Map<string, Typeface>()

  function register(key: string): Typeface | undefined {
    if (typefaces.has(key)) return typefaces.get(key)!
    const buf = store.get(key)
    if (!buf) return undefined

    const tf = ck.Typeface.MakeFreeTypeFaceFromData(buf)
    if (!tf) {
      console.warn(`[typeface-registry] Failed to make typeface for "${key}"`)
      return undefined
    }
    typefaces.set(key, tf)
    return tf
  }

  function dispose() {
    typefaces.forEach((tf) => tf.delete())
    typefaces.clear()
  }

  return {
    register,
    get: (key) => typefaces.get(key),
    dispose,
  }
}
