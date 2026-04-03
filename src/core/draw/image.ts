import type { Canvas, CanvasKit, Image, Paint } from 'canvaskit-wasm'
import type { ImageStyle } from '@/core/styles'
import type { Rect } from './types'

interface CompiledImage {
  src: string
  image: Image | null
  isLoading: boolean
  cachedStylePaint: Paint | null
}

// Global cache for unique images to prevent loading same assets exponentially via refs
const imageAssetCache = new Map<
  string,
  { image: Image | null; promise: Promise<Image | null> | null }
>()

async function prefetchImage(ck: CanvasKit, src: string): Promise<Image | null> {
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

const compileCache = new WeakMap<ImageStyle, CompiledImage>()

export function image(ck: CanvasKit, canvas: Canvas, style: ImageStyle, src: string, rect: Rect) {
  let compiled = compileCache.get(style)

  // Map updates or First Frame
  if (!compiled || compiled.src !== src) {
    if (compiled?.cachedStylePaint) {
      compiled.cachedStylePaint.delete()
    }

    let paint: Paint | null = null
    if (style.opacity !== undefined || style.tintColor) {
      paint = new ck.Paint()
      paint.setAntiAlias(true)
      if (style.opacity !== undefined) paint.setAlphaf(style.opacity)
      if (style.tintColor) {
        const tint = ck.parseColorString(style.tintColor)
        if (tint) paint.setColorFilter(ck.ColorFilter.MakeBlend(tint, ck.BlendMode.SrcIn))
      }
    }

    compiled = {
      src,
      image: imageAssetCache.get(src)?.image || null,
      isLoading: !imageAssetCache.has(src) || !!imageAssetCache.get(src)?.promise,
      cachedStylePaint: paint,
    }
    compileCache.set(style, compiled)

    // Eagerly resolve fetch promise if mapping indicates caching boundaries isn't hit.
    if (compiled.isLoading) {
      prefetchImage(ck, src).then((img) => {
        if (compiled && img) {
          compiled.image = img
          compiled.isLoading = false
        }
      })
    }
  }

  // Preview / Loader placeholders
  if (compiled.isLoading) {
    if (style.backgroundColor && style.backgroundColor !== 'transparent') {
      const fillPaint = new ck.Paint()
      fillPaint.setColor(ck.parseColorString(style.backgroundColor) || ck.Color4f(0, 0, 0, 0))
      const bounds = ck.LTRBRect(rect.x, rect.y, rect.x + rect.width, rect.y + rect.height)
      canvas.drawRect(bounds, fillPaint)
      fillPaint.delete()
    }
    return
  }

  // Native Image layout scaling bindings mapped directly
  if (compiled.image) {
    const destRect = ck.LTRBRect(rect.x, rect.y, rect.x + rect.width, rect.y + rect.height)
    // Object fit scaling can strictly be done here by mapping proportions later.
    // Currently resolving absolute boundaries natively (stretch)
    canvas.drawImageRect(
      compiled.image,
      ck.LTRBRect(0, 0, compiled.image.width(), compiled.image.height()),
      destRect,
      compiled.cachedStylePaint!,
      false,
    )
  }
}
