import type { CanvasKit, FontMgr } from 'canvaskit-wasm'
import type { FontStore } from './font-store'

/**
 * Builds a FontMgr from the given CanvasKit, FontStore, and array of font buffer keys.
 *
 * The function first maps the given keys to their corresponding font buffers in the given FontStore,
 * and filters out any undefined values. If no font buffers are available, it throws an error.
 *
 * It then calls FontMgr.FromData() with the remaining font buffers, and throws an error if the
 * resulting FontMgr is null.
 *
 * @param {CanvasKit} ck - The CanvasKit instance to create the FontMgr with.
 * @param {FontStore} store - The FontStore containing the font buffers to use.
 * @param {string[]} keys - The keys of the font buffers to use.
 * @returns {FontMgr} The resulting FontMgr instance.
 * @throws {Error} If no font buffers are available, or if FontMgr.FromData returns null.
 */
export function buildFontMgr(ck: CanvasKit, store: FontStore, keys: string[]): FontMgr {
  const buffers = keys.map((k) => store.get(k)).filter((b): b is ArrayBuffer => b !== undefined)

  if (buffers.length === 0) {
    throw new Error('[font-mgr-factory] No font buffers available to build FontMgr')
  }

  // All fallback fonts must go into the SAME FontMgr.FromData() call
  const mgr = ck.FontMgr.FromData(...buffers)
  if (!mgr) throw new Error('[font-mgr-factory] FontMgr.FromData returned null')

  return mgr
}
