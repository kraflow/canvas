export interface FontStore {
  get(key: string): ArrayBuffer | undefined
  set(key: string, buf: ArrayBuffer): void
  has(key: string): boolean
  release(key: string): void
  allKeys(): string[]
}

/**
 * Creates a new FontStore instance.
 *
 * A FontStore is an object that provides an interface to store and retrieve
 * font data buffers. It is used to store and manage the font data buffers
 * used by the Canvas engine.
 *
 * The interface provides methods to get, set, and release font data buffers,
 * as well as a method to check if a buffer is present in the store.
 *
 * @returns {FontStore} A new FontStore instance.
 */
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

/**
 * Returns a unique key for a font family and weight combination.
 *
 * The key is a string of the form `<family>:<weight>`.
 *
 * @param {string} family - The font family name.
 * @param {number} weight - The font weight value.
 * @returns {string} A unique key for the given font family and weight.
 */
export function fontKey(family: string, weight: number): string {
  return `${family}:${weight}`
}
