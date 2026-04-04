import type { CanvasKit, Image } from 'canvaskit-wasm'

/**
 * A cached image entry with reference counting.
 * When refCount reaches 0, the CanvasKit Image is deleted and the entry removed.
 */
interface CachedImage {
  image: Image
  refCount: number
}

/**
 * ImageCache manages CanvasKit Image objects with reference counting.
 *
 * Usage:
 *   const cache = new ImageCache(ck)
 *   const img = await cache.load('https://example.com/photo.jpg')  // refCount = 1
 *   cache.acquire('https://example.com/photo.jpg')                 // refCount = 2
 *   cache.release('https://example.com/photo.jpg')                 // refCount = 1
 *   cache.release('https://example.com/photo.jpg')                 // refCount = 0 → deleted
 */
export class ImageCache {
  private readonly ck: CanvasKit
  private readonly cache = new Map<string, CachedImage>()

  constructor(ck: CanvasKit) {
    this.ck = ck
  }

  /**
   * Loads an image from a URL, decodes it, and caches it with refCount = 1.
   * If the image is already cached, increments refCount and returns the cached image.
   *
   * @param url - The URL to fetch the image from (also used as the cache key).
   * @returns The decoded Image, or null if loading/decoding failed.
   */
  async load(url: string): Promise<Image | null> {
    const existing = this.cache.get(url)
    if (existing) {
      existing.refCount++
      return existing.image
    }

    try {
      const response = await fetch(url)
      if (!response.ok) {
        console.warn(`[ImageCache] Failed to fetch ${url}: ${response.status}`)
        return null
      }

      const data = await response.arrayBuffer()
      const image = this.ck.MakeImageFromEncoded(new Uint8Array(data))

      if (!image) {
        console.warn(`[ImageCache] Failed to decode image from ${url}`)
        return null
      }

      this.cache.set(url, { image, refCount: 1 })
      return image
    } catch (err) {
      console.warn(`[ImageCache] Error loading ${url}:`, err)
      return null
    }
  }

  /**
   * Loads an image from raw bytes, decodes it, and caches it with refCount = 1.
   * If an image with the given key is already cached, increments refCount and returns it.
   *
   * @param key - A unique key for this image in the cache.
   * @param bytes - Raw image bytes (PNG, JPEG, WebP, etc.).
   * @returns The decoded Image, or null if decoding failed.
   */
  loadBytes(key: string, bytes: Uint8Array): Image | null {
    const existing = this.cache.get(key)
    if (existing) {
      existing.refCount++
      return existing.image
    }

    const image = this.ck.MakeImageFromEncoded(bytes)
    if (!image) {
      console.warn(`[ImageCache] Failed to decode image for key "${key}"`)
      return null
    }

    this.cache.set(key, { image, refCount: 1 })
    return image
  }

  /**
   * Acquires a reference to an already-cached image (increments refCount).
   * Returns null if the image is not in the cache.
   *
   * @param key - The cache key (URL or custom key).
   */
  acquire(key: string): Image | null {
    const entry = this.cache.get(key)
    if (!entry) return null
    entry.refCount++
    return entry.image
  }

  /**
   * Releases a reference to a cached image (decrements refCount).
   * When refCount reaches 0, the CanvasKit Image is deleted and removed from cache.
   *
   * @param key - The cache key (URL or custom key).
   */
  release(key: string): void {
    const entry = this.cache.get(key)
    if (!entry) return

    entry.refCount--
    if (entry.refCount <= 0) {
      entry.image.delete()
      this.cache.delete(key)
    }
  }

  /**
   * Returns the current reference count for a cached image, or 0 if not cached.
   */
  refCount(key: string): number {
    return this.cache.get(key)?.refCount ?? 0
  }

  /**
   * Returns true if an image with the given key is currently cached.
   */
  has(key: string): boolean {
    return this.cache.has(key)
  }

  /**
   * Returns the number of images currently in the cache.
   */
  get size(): number {
    return this.cache.size
  }

  /**
   * Disposes of all cached images, deleting their CanvasKit resources.
   * Call this when the cache is no longer needed (e.g., on component unmount).
   */
  dispose(): void {
    for (const entry of this.cache.values()) {
      entry.image.delete()
    }
    this.cache.clear()
  }
}
