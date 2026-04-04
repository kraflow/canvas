import type { Canvas, CanvasKit, Image as CKImage, ColorFilter } from 'canvaskit-wasm'
import type { ResolvedImageStyle } from '@/core/styles'
import type { LayoutRectRect, ScratchPaints } from './types'

// Global cache for unique images to prevent loading same assets exponentially via refs
const imageAssetCache = new Map<
  string,
  { image: CKImage | null; promise: Promise<CKImage | null> | null; ref: number }
>()

async function prefetchImage(ck: CanvasKit, src: string): Promise<CKImage | null> {
  const existing = imageAssetCache.get(src)
  if (existing?.image) return existing.image
  if (existing?.promise) return existing.promise

  const fetchPromise = fetch(src)
    .then((r) => r.arrayBuffer())
    .then((buffer) => {
      const img = ck.MakeImageFromEncoded(buffer)
      if (img) imageAssetCache.set(src, { image: img, promise: null, ref: 0 })
      return img
    })
    .catch((err) => {
      console.error('[ImageCache] Failed to load remote src:', src, err)
      return null
    })

  imageAssetCache.set(src, { image: null, promise: fetchPromise, ref: 0 })
  return fetchPromise
}

export function image(
  ck: CanvasKit,
  canvas: Canvas,
  rs: ResolvedImageStyle,
  src: string,
  rect: LayoutRectRect,
  paints: ScratchPaints,
) {
  if (!rs.display) return

  // Setup image paint
  paints.image.setAlphaf(rs.opacity !== undefined ? rs.opacity : 1)

  let cf: ColorFilter | null = null
  if (rs.tintColor) {
    cf = ck.ColorFilter.MakeBlend(rs.tintColor, ck.BlendMode.SrcIn)
    paints.image.setColorFilter(cf)
  } else {
    paints.image.setColorFilter(null)
  }

  const image = imageAssetCache.get(src)

  let isLoading = false
  if (!image) {
    isLoading = true
    prefetchImage(ck, src)
  } else {
    isLoading = false
  }

  // Preview / Loader placeholders
  if (isLoading || !image!.image) {
    if (rs.backgroundColor) {
      paints.fill.setColor(rs.backgroundColor)
      paints.fill.setStyle(ck.PaintStyle.Fill)
      paints.fill.setMaskFilter(null)
      const bounds = ck.LTRBRect(rect.x, rect.y, rect.x + rect.w, rect.y + rect.h)
      canvas.drawRect(bounds, paints.fill)
    }
    if (cf) cf.delete()
    return
  }

  // Native Image layout scaling bindings
  const imgW = image!.image.width()
  const imgH = image!.image.height()
  const destW = rect.w
  const destH = rect.h

  let srcRect = ck.LTRBRect(0, 0, imgW, imgH)
  let destRect = ck.LTRBRect(rect.x, rect.y, rect.x + destW, rect.y + destH)

  const mode = rs.mode

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

  canvas.drawImageRect(image!.image, srcRect, destRect, paints.image, false)

  if (rs.overlayColor) {
    paints.fill.setColor(rs.overlayColor)
    // Draw over the same dest bounds to cover just the image area
    canvas.drawRect(destRect, paints.fill)
  }

  if (cf) cf.delete()
}
