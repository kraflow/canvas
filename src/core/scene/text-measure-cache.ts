import type { TextStyle } from '@/core/styles'

/**
 * Result of a text measurement with staleness tracking.
 */
export interface MeasureResult {
  width: number
  height: number
  lastAccessed: number
}

/**
 * An LRU cache with TTL (Time-To-Live) for text measurements.
 *
 * It caches the width and height of a piece of text. Entries are deleted if:
 * 1. The cache exceeds maxEntries (LRU eviction).
 * 2. They haven't been accessed for more than ttlMillis (TTL eviction).
 */
export class TextMeasureCache {
  private readonly cache = new Map<string, MeasureResult>()
  private readonly maxEntries: number
  private readonly ttlMillis: number

  /**
   * @param maxEntries Max number of entries to keep.
   * @param ttlMillis Time in milliseconds before an entry is considered stale (default 5 minutes).
   */
  constructor(maxEntries = 1000, ttlMillis = 5 * 60 * 1000) {
    this.maxEntries = maxEntries
    this.ttlMillis = ttlMillis
  }

  /**
   * Generates a cache key for the given text, style, and available width.
   */
  public makeKey(text: string, style: TextStyle, maxWidth: number): string {
    const keyParts = [
      text,
      style.fontFamily ?? 'Inter',
      style.fontSize ?? 14,
      style.fontWeight ?? 400,
      style.fontStyle ?? 'normal',
      style.letterSpacing ?? 0,
      style.lineHeight ?? 0,
      style.textTransform ?? 'none',
      Math.round(maxWidth),
    ]
    return keyParts.join('|')
  }

  /**
   * Look up a measurement in the cache. Checks if it's stale.
   */
  public get(key: string): MeasureResult | undefined {
    const result = this.cache.get(key)
    if (!result) return undefined

    const now = Date.now()
    if (now - result.lastAccessed > this.ttlMillis) {
      this.cache.delete(key)
      return undefined
    }

    // Update access time for LRU and TTL
    result.lastAccessed = now
    this.cache.delete(key)
    this.cache.set(key, result)

    return result
  }

  /**
   * Stores a measurement result.
   */
  public set(key: string, result: Omit<MeasureResult, 'lastAccessed'>): void {
    const now = Date.now()

    // Evict if full
    if (this.cache.size >= this.maxEntries) {
      const oldestKey = this.cache.keys().next().value
      if (oldestKey !== undefined) {
        this.cache.delete(oldestKey)
      }
    }

    this.cache.set(key, { ...result, lastAccessed: now })
  }

  /**
   * Explicitly remove stale entries.
   */
  public pruneStale(): void {
    const now = Date.now()
    for (const [key, value] of this.cache.entries()) {
      if (now - value.lastAccessed > this.ttlMillis) {
        this.cache.delete(key)
      }
    }
  }

  public clear(): void {
    this.cache.clear()
  }

  public get size(): number {
    return this.cache.size
  }
}
