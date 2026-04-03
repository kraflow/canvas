import type { FontStore } from './font-store'

export interface FontLoader {
  load(key: string, url: string): Promise<ArrayBuffer>
  isLoaded(key: string): boolean
  loadedKeys(): string[]
}

export function createFontLoader(store: FontStore, maxConcurrent = 3): FontLoader {
  const inflight = new Map<string, Promise<ArrayBuffer>>()
  const failed = new Set<string>()
  const queue: Array<{
    key: string
    url: string
    resolve: (b: ArrayBuffer) => void
    reject: (e: unknown) => void
  }> = []
  let active = 0

  function flush() {
    while (queue.length > 0 && active < maxConcurrent) {
      const item = queue.shift()!
      active++
      fetch(item.url)
        .then((r) => {
          if (!r.ok) throw new Error(`Font fetch failed: ${r.status} ${item.url}`)
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

  function load(key: string, url: string): Promise<ArrayBuffer> {
    if (failed.has(key)) return Promise.reject(new Error(`[font-loader] Previously failed to load ${key}`))

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
