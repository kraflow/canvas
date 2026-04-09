import type { FontStore } from './font-store'
import { devThrow } from '../utils/dev-error'

export interface FontLoader {
  load(key: string, url: string): Promise<ArrayBuffer>
  isLoaded(key: string): boolean
  loadedKeys(): string[]
}

/**
 * Creates a font loader that loads font files in the background.
 * @param {FontStore} store - The font store to store loaded fonts.
 * @param {number} [maxConcurrent=3] - The maximum number of concurrent font loads.
 * @returns {FontLoader} - A font loader object with methods to load, check if loaded, and retrieve loaded keys.
 */
export function createFontLoader(store: FontStore, maxConcurrent: number = 3): FontLoader {
  const inflight = new Map<string, Promise<ArrayBuffer>>()
  const failed = new Set<string>()
  const queue: Array<{
    key: string
    url: string
    resolve: (b: ArrayBuffer) => void
    reject: (e: unknown) => void
  }> = []
  let active = 0

  /**
   * Flushes the font loading queue by loading the next font in the queue.
   * This function is called recursively until the queue is empty or the maximum number of concurrent font loads is reached.
   * When a font is loaded, it is stored in the given font store and the promise associated with the key is resolved.
   * If a font fails to load, the promise associated with the key is rejected with an error.
   */
  function flush() {
    while (queue.length > 0 && active < maxConcurrent) {
      const item = queue.shift()!
      active++
      fetch(item.url)
        .then((r) => {
          if (!r.ok) devThrow(`Font fetch failed: ${r.status} ${item.url}`)
          return r.arrayBuffer()
        })
        .then((buf) => {
          store.set(item.key, buf)
          inflight.delete(item.key)
          item.resolve(buf)
        })
        .catch((err) => {
          inflight.delete(item.key)
          failed.add(item.key)
          item.reject(err)
        })
        .finally(() => {
          active--
          flush()
        })
    }
  }

  /**
   * Loads a font from the given URL and stores it in the font store under the given key.
   * If the font has previously failed to load, this function will immediately reject with an error.
   * If the font is already cached or loading, this function will return the cached or pending promise.
   * Otherwise, this function will add the font to the loading queue and return a new promise that will be resolved when the font is loaded.
   * If the font fails to load, the promise will be rejected with an error.
   * @param key - The key to store the font under in the font store.
   * @param url - The URL of the font to load.
   * @returns A promise that resolves with the loaded font data or rejects with an error.
   */
  function load(key: string, url: string): Promise<ArrayBuffer> {
    if (failed.has(key))
      return Promise.reject(new Error(`[font-loader] Previously failed to load ${key}`))

    const cached = store.get(key)
    if (cached) return Promise.resolve(cached)

    const pending = inflight.get(key)
    if (pending) return pending

    const promise = new Promise<ArrayBuffer>((resolve, reject) => {
      queue.push({ key, url, resolve, reject })
      flush()
    })

    inflight.set(key, promise)
    return promise
  }

  return {
    load,
    isLoaded: (key) => store.has(key),
    loadedKeys: () => store.allKeys(),
  }
}
