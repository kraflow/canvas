// open-pencil-style fallback: cache last valid SkPicture so text
// renders correctly even when the font becomes unavailable.

import type { CanvasKit, SkPicture } from 'canvaskit-wasm'

export interface PictureCache {
  store(nodeId: string, picture: SkPicture): void
  get(nodeId: string): SkPicture | undefined
  invalidate(nodeId: string): void
  dispose(): void
}

export function createPictureCache(maxEntries = 256): PictureCache {
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
