import type { CanvasKit, FontMgr } from 'canvaskit-wasm'
import type { FontStore } from './font-store'

let currentMgr: FontMgr | null = null

export function buildFontMgr(ck: CanvasKit, store: FontStore, keys: string[]): FontMgr {
  // Free previous manager before rebuilding
  if (currentMgr) {
    currentMgr.delete()
    currentMgr = null
  }

  const buffers = keys.map((k) => store.get(k)).filter((b): b is ArrayBuffer => b !== undefined)

  if (buffers.length === 0) {
    throw new Error('[font-mgr-factory] No font buffers available to build FontMgr')
  }

  // All fallback fonts must go into the SAME FontMgr.FromData() call
  const mgr = ck.FontMgr.FromData(...buffers)
  if (!mgr) throw new Error('[font-mgr-factory] FontMgr.FromData returned null')

  currentMgr = mgr
  return mgr
}

export function getCurrentFontMgr(): FontMgr | null {
  return currentMgr
}

export function disposeFontMgr(): void {
  if (currentMgr) {
    currentMgr.delete()
    currentMgr = null
  }
}
