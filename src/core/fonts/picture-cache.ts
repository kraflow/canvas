import type { CanvasKit, SkPicture } from 'canvaskit-wasm'

export interface PictureCache {
  store(nodeId: string, picture: SkPicture): void
  get(nodeId: string): SkPicture | undefined
  invalidate(nodeId: string): void
  dispose(): void
}

/**
 * Creates a PictureCache instance with a maximum number of entries.
 * The cache is a simple LRU (Least Recently Used) cache implemented using an insertion-order Map.
 * When the cache reaches its maximum size, the oldest entry is evicted to make room for new entries.
 * @param {number} [maxEntries=256] - The maximum number of entries in the cache.
 * @returns {PictureCache} - A new PictureCache instance.
 */
export function createPictureCache(maxEntries: number = 256): PictureCache {
  // Simple LRU via insertion-order Map
  const cache = new Map<string, SkPicture>()

  function evict() {
    if (cache.size >= maxEntries) {
      const oldest = cache.keys().next().value
      if (oldest) {
        cache.get(oldest)?.delete()
        cache.delete(oldest)
      }
    }
  }

  return {
    store(nodeId, picture) {
      if (cache.has(nodeId)) {
        cache.get(nodeId)?.delete()
        cache.delete(nodeId)
      }
      evict()
      cache.set(nodeId, picture)
    },
    get: (nodeId) => cache.get(nodeId),
    invalidate(nodeId) {
      cache.get(nodeId)?.delete()
      cache.delete(nodeId)
    },
    dispose() {
      cache.forEach((p) => p.delete())
      cache.clear()
    },
  }
}

/**
 * Records a picture by drawing into a temporary canvas using the given
 * draw function, and returns the recorded picture.
 * @param {CanvasKit} ck - The CanvasKit instance to use.
 * @param {number} width - The width of the picture to record.
 * @param {number} height - The height of the picture to record.
 * @param {function} draw - A function that takes a temporary canvas as an argument,
 * and draws into it. The resulting drawing will be recorded as a picture.
 * @returns {SkPicture} - The recorded picture.
 */
export function recordToPicture(
  ck: CanvasKit,
  width: number,
  height: number,
  draw: (canvas: import('canvaskit-wasm').Canvas) => void,
): SkPicture {
  const recorder = new ck.PictureRecorder()
  const canvas = recorder.beginRecording(ck.LTRBRect(0, 0, width, height))
  draw(canvas)
  return recorder.finishRecordingAsPicture()
}
