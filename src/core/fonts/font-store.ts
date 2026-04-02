// Owns raw ArrayBuffers — survives CanvasKit context loss

export interface FontStore {
  get(key: string): ArrayBuffer | undefined
  set(key: string, buf: ArrayBuffer): void
  has(key: string): boolean
  release(key: string): void
  allKeys(): string[]
}

export function createFontStore(): FontStore {
  const buffers = new Map<string, ArrayBuffer>()

  return {
    get: (key) => buffers.get(key),
    set: (key, buf) => {
      buffers.set(key, buf)
    },
    has: (key) => buffers.has(key),
    release: (key) => {
      buffers.delete(key)
    },
    allKeys: () => [...buffers.keys()],
  }
}

export function fontKey(family: string, weight: number): string {
  return `${family}:${weight}`
}
