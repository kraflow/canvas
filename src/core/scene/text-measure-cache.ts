import type { TextStyle } from '@/core/styles'
import { CONFIG } from '../constants'

/**
 * Result of a text measurement.
 */
export interface MeasureResult {
  width: number
  height: number
}

/**
 * An LRU cache for text measurements.
 *
 * It caches the width and height of a text measurement by key.
 * Entries are evicted when the cache exceeds maxEntries (LRU eviction).
 */
export class TextMeasureCache {
  private readonly cache = new Map<string, MeasureResult>()
  private readonly maxEntries: number

  /**
   * @param maxEntries Max number of entries to keep.
   */
  constructor(maxEntries = CONFIG.TEXT_CACHE_MAX_ENTRIES) {
    this.maxEntries = maxEntries
  }

  /**
   * Generates a cache key from text content and style properties.
   * Only includes properties that affect text measurements.
   */
  public static makeKey(text: string, style: TextStyle, maxWidth?: number): string {
    const {
      fontFamily,
      fontSize,
      fontWeight,
      fontStyle,
      letterSpacing,
      lineHeight,
      textTransform,
    } = style

    return [
      text,
      fontFamily,
      fontSize,
      fontWeight,
      fontStyle || 'normal',
      letterSpacing,
      lineHeight,
      textTransform || 'none',
      maxWidth,
    ].join('|')
  }

  /**
   * Look up a measurement in the cache.
   */
  public get(key: string): MeasureResult | undefined {
    const result = this.cache.get(key)
    if (!result) return undefined

    // Move to end (most recently used)
    this.cache.delete(key)
    this.cache.set(key, result)

    return result
  }

  /**
   * Stores a measurement result.
   */
  public set(key: string, result: MeasureResult): void {
    // Evict oldest if full
    if (this.cache.size >= this.maxEntries && !this.cache.has(key)) {
      const oldestKey = this.cache.keys().next().value
      if (oldestKey !== undefined) {
        this.cache.delete(oldestKey)
      }
    }

    this.cache.set(key, result)
  }

  public clear(): void {
    this.cache.clear()
  }

  public get size(): number {
    return this.cache.size
  }
}
