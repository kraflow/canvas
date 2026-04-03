import type { Canvas, CanvasKit, Image as CKImage } from 'canvaskit-wasm'
import type { ImageStyle } from '@/core/styles'
import type { Rect, ScratchPaints } from './types'
import type { ImageContext } from './context'

// Global cache for unique images to prevent loading same assets exponentially via refs
const imageAssetCache = new Map<
  string,
  { image: CKImage | null; promise: Promise<CKImage | null> | null }
>()

async function prefetchImage(ck: CanvasKit, src: string): Promise<CKImage | null> {
  const existing = imageAssetCache.get(src)
  if (existing?.image) return existing.image
  if (existing?.promise) return existing.promise

  const fetchPromise = fetch(src)
    .then((r) => r.arrayBuffer())
    .then((buffer) => {
      const img = ck.MakeImageFromEncoded(buffer)
      if (img) imageAssetCache.set(src, { image: img, promise: null })
      return img
    })
    .catch((err) => {
      console.error('[ImageCache] Failed to load remote src:', src, err)
      return null
    })

  imageAssetCache.set(src, { image: null, promise: fetchPromise })
  return fetchPromise
}

export function image(
  ck: CanvasKit,
  canvas: Canvas,
  ctx: ImageContext,
  style: ImageStyle,
  src: string,
  rect: Rect,
  paints: ScratchPaints,
) {
  // Setup image paint
  paints.image.setAlphaf(style.opacity !== undefined ? style.opacity : 1)
  if (style.tintColor) {
    const tint = ck.parseColorString(style.tintColor)
    if (tint) {
      paints.image.setColorFilter(ck.ColorFilter.MakeBlend(tint, ck.BlendMode.SrcIn))
    } else {
      paints.image.setColorFilter(null)
    }
  } else {
    paints.image.setColorFilter(null)
  }

  // Handle src changes
  if (ctx.cachedSrc !== src) {
    ctx.cachedSrc = src
    ctx.image = imageAssetCache.get(src)?.image || null
    ctx.isLoading = !imageAssetCache.has(src) || !!imageAssetCache.get(src)?.promise

    if (ctx.isLoading) {
      prefetchImage(ck, src).then((img) => {
        // Only assign if context hasn't shifted source before resolution
        if (ctx.cachedSrc === src && img) {
          ctx.image = img
          ctx.isLoading = false
        }
      })
    }
  }

  // Preview / Loader placeholders
  if (ctx.isLoading || !ctx.image) {
    if (style.backgroundColor && style.backgroundColor !== 'transparent') {
      const color = ck.parseColorString(style.backgroundColor) || ck.Color4f(0, 0, 0, 0)
      paints.fill.setColor(color)
      const bounds = ck.LTRBRect(rect.x, rect.y, rect.x + rect.width, rect.y + rect.height)
      canvas.drawRect(bounds, paints.fill)
    }
    return
  }

  // Native Image layout scaling bindings
  if (ctx.image) {
    const imgW = ctx.image.width()
    const imgH = ctx.image.height()
    const destW = rect.width
    const destH = rect.height

    let srcRect = ck.LTRBRect(0, 0, imgW, imgH)
    let destRect = ck.LTRBRect(rect.x, rect.y, rect.x + destW, rect.y + destH)

    const mode = style.objectFit || style.resizeMode || 'cover'

    if (mode === 'contain' || mode === 'scale-down') {
      let scale = Math.min(destW / imgW, destH / imgH)
      if (mode === 'scale-down' && scale > 1) scale = 1 // Don't scale up
      const w = imgW * scale
      const h = imgH * scale
      const cx = rect.x + (destW - w) / 2
      const cy = rect.y + (destH - h) / 2
      destRect = ck.LTRBRect(cx, cy, cx + w, cy + h)
    } else if (mode === 'cover') {
      const scale = Math.max(destW / imgW, destH / imgH)
      const w = destW / scale
      const h = destH / scale
      const cx = (imgW - w) / 2
      const cy = (imgH - h) / 2
      srcRect = ck.LTRBRect(cx, cy, cx + w, cy + h)
    } else if (mode === 'center') {
      const cx = rect.x + (destW - imgW) / 2
      const cy = rect.y + (destH - imgH) / 2
      destRect = ck.LTRBRect(cx, cy, cx + imgW, cy + imgH)
    } else if (mode === 'repeat') {
      // Repeat would need a shader or repeated draw calls, fallback to stretch/fill for now
    }

    canvas.drawImageRect(ctx.image, srcRect, destRect, paints.image, false)

    if (style.overlayColor) {
      const color = ck.parseColorString(style.overlayColor) || ck.Color4f(0, 0, 0, 0)
      paints.fill.setColor(color)
      // Draw over the same dest bounds to cover just the image area
      canvas.drawRect(destRect, paints.fill)
    }
  }
}
