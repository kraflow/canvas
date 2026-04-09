import type { CanvasKit, Image as SkImage } from 'canvaskit-wasm'
import { devThrow } from '../../utils/dev-error'

type CacheEntry = {
  skImage: SkImage
  lastUsed: number
  bytes: number
  refCount: number
}

/**
 * ImageCache loads images using the fast browser-decode path:
 *   fetch → createImageBitmap (browser codec, off-main-thread)
 *         → MakeImageFromCanvasImageSource (GPU texture, no WASM decode)
 *
 * Features:
 * - Deduplicates in-flight requests (no double-fetch for same src)
 * - LRU eviction by memory budget (default 256 MB)
 * - Explicit .delete() on eviction — no WASM/GPU leaks
 * - Returns a placeholder (null) while loading, caller re-renders on resolution
 */
export class ImageCache {
  private readonly ck: CanvasKit
  private readonly maxBytes: number

  // Loaded entries keyed by src URL
  private readonly cache = new Map<string, CacheEntry>()
  // In-flight promises — deduplicates concurrent requests for the same src
  private readonly inflight = new Map<string, Promise<SkImage | null>>()

  private usedBytes = 0

  constructor(ck: CanvasKit, maxMB = 256) {
    this.ck = ck
    this.maxBytes = maxMB * 1024 * 1024
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /**
   * Returns the cached SkImage synchronously if available, null otherwise.
   * Kicks off a background load on first call; call again after the returned
   * promise resolves (trigger a re-render on resolution).
   *
   * @param src    URL of the image
   * @param onLoad Called when the image finishes loading (trigger re-render here)
   */
  get(src: string, onLoad?: () => void): SkImage | null {
    const entry = this.cache.get(src)
    if (entry) {
      entry.lastUsed = now()
      return entry.skImage
    }

    // Not cached — start loading if not already in flight
    if (!this.inflight.has(src)) {
      const promise = this._load(src)
      this.inflight.set(src, promise)
      promise.then((skImage) => {
        this.inflight.delete(src)
        if (skImage) onLoad?.()
      })
    }

    return null
  }

  /**
   * Await-able version. Useful for pre-loading during import/reconstruct.
   */
  async load(src: string): Promise<SkImage | null> {
    const entry = this.cache.get(src)
    if (entry) {
      entry.lastUsed = now()
      entry.refCount++
      return entry.skImage
    }

    let promise = this.inflight.get(src)
    if (!promise) {
      promise = this._load(src)
      this.inflight.set(src, promise)
      promise.then(() => this.inflight.delete(src))
    }
    return promise
  }

  /** Explicitly remove a single entry and free its GPU memory. */
  evict(src: string): void {
    const entry = this.cache.get(src)
    if (entry) {
      entry.refCount--
      if (entry.refCount === 0) {
        this._evictEntry(src)
      }
    }
  }

  /** Free all GPU/WASM resources. Call when the renderer is disposed. */
  dispose(): void {
    for (const src of this.cache.keys()) this._evictEntry(src)
  }

  get memoryUsedMB(): number {
    return this.usedBytes / (1024 * 1024)
  }

  // ── Core load pipeline ─────────────────────────────────────────────────────

  private async _load(src: string): Promise<SkImage | null> {
    try {
      // Step 1: Fetch compressed bytes
      const response = await fetch(src)
      if (!response.ok) devThrow(`HTTP ${response.status}`)
      const blob = await response.blob()

      // Step 2: Decode off-main-thread via browser codec
      // createImageBitmap uses the browser's native image decoder (hardware-
      // accelerated where available) and runs off the main thread in Chrome.
      const bitmap = await createImageBitmap(blob)

      // Step 3: Upload to GPU as a WebGL texture via CanvasKit.
      // MakeImageFromCanvasImageSource wraps the ImageBitmap as a lazy SkImage —
      // the actual WebGL texture upload happens on first draw, not here.
      const skImage = this.ck.MakeImageFromCanvasImageSource(bitmap)

      // Step 4: Free the JS-side ImageBitmap immediately.
      // Skia has taken ownership of the texture; the bitmap is no longer needed.
      bitmap.close()

      if (!skImage) devThrow('MakeImageFromCanvasImageSource returned null')

      // Step 5: Account for memory and evict if over budget.
      // Approximate: width * height * 4 bytes (RGBA)
      const byteSize = skImage.width() * skImage.height() * 4
      this._ensureBudget(byteSize)
      this.cache.set(src, { skImage, lastUsed: now(), bytes: byteSize, refCount: 1 })
      this.usedBytes += byteSize

      return skImage
    } catch (err) {
      console.warn(`[ImageCache] Failed to load "${src}":`, err)
      return null
    }
  }

  // ── Memory management ──────────────────────────────────────────────────────

  /**
   * Evict LRU entries until there is room for `incoming` bytes.
   */
  private _ensureBudget(incoming: number): void {
    if (this.usedBytes + incoming <= this.maxBytes) return

    // Sort by lastUsed ascending (oldest first)
    const entries = [...this.cache.entries()].sort((a, b) => a[1].lastUsed - b[1].lastUsed)

    for (const [src] of entries) {
      if (this.usedBytes + incoming <= this.maxBytes) break
      this._evictEntry(src)
    }
  }

  private _evictEntry(src: string): void {
    const entry = this.cache.get(src)
    if (!entry) return
    entry.skImage.delete() // releases WASM ref + WebGL texture
    this.usedBytes -= entry.bytes
    this.cache.delete(src)
  }
}

function now(): number {
  return performance.now()
}
