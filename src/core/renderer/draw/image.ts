import type { Canvas, CanvasKit, Image } from 'canvaskit-wasm'
import type { ImageStyle, ColorValue } from '@/core/styles'
import type { LayoutRect } from '../types'
import { toColor } from './color'
import { resolveRadii, isSharpRect, makeRRect } from './path'
import { renderView } from './view'

/**
 * Renders an Image element on the CanvasKit canvas with all applicable visual styles.
 *
 * The image renderer:
 * 1. Delegates all ViewStyle rendering (background, borders, shadows, transforms,
 *    opacity, filters, overflow clipping) to renderView via the drawContent callback
 * 2. Draws the image itself with:
 *    - resizeMode / objectFit (cover, contain, stretch, fill, center, repeat, scale-down)
 *    - tintColor
 *    - Border-radius clipping
 *
 * Note: scroll is NOT supported on Image — only View can have scroll position.
 */
export function renderImage(
  ck: CanvasKit,
  canvas: Canvas,
  style: ImageStyle,
  rect: LayoutRect,
  image: Image | null,
): void {
  if (style.display === 'none') return

  const { x, y, w, h } = rect
  if (w <= 0 || h <= 0) return

  // If no image, just render the view (background, borders, etc.)
  if (!image) {
    renderView(ck, canvas, style, rect)
    return
  }

  // Render the view with image drawing as the content callback.
  // Transforms, opacity, filters, overflow clipping are all handled by renderView.
  renderView(ck, canvas, style, rect, undefined, () => {
    canvas.save()

    // ── Clip to border radii for image content ─────────────────────────────
    // Images should always clip to border radii, even if overflow isn't 'hidden'.
    const radii = resolveRadii(style, w, h)
    if (!isSharpRect(radii)) {
      const rrect = makeRRect(ck, rect, radii)
      canvas.clipRRect(rrect, ck.ClipOp.Intersect, true)
    }

    // ── Calculate source/dest rects based on resizeMode/objectFit ──────────
    const imgW = image.width()
    const imgH = image.height()
    const srcRect = Float32Array.from([0, 0, imgW, imgH])

    const fit = resolveObjectFit(style)
    const destRect = computeDestRect(fit, imgW, imgH, x, y, w, h)

    // ── Create paint for the image ────────────────────────────────────────
    const paint = new ck.Paint()
    paint.setAntiAlias(true)

    // Apply tint color
    if (style.tintColor) {
      const tintCF = makeTintColorFilter(ck, style.tintColor)
      if (tintCF) {
        paint.setColorFilter(tintCF)
      }
    }

    // ── Handle repeat mode ────────────────────────────────────────────────
    if (fit === 'repeat') {
      drawRepeatedImage(ck, canvas, image, paint, x, y, w, h)
    } else {
      canvas.drawImageRect(image, srcRect, destRect, paint)
    }

    paint.delete()
    canvas.restore()
  })
}

// =============================================================================
// Object fit / resize mode resolution
// =============================================================================

type FitMode = 'cover' | 'contain' | 'fill' | 'center' | 'repeat' | 'scale-down'

function resolveObjectFit(style: ImageStyle): FitMode {
  // objectFit takes precedence over resizeMode
  if (style.objectFit) {
    switch (style.objectFit) {
      case 'cover':
        return 'cover'
      case 'contain':
        return 'contain'
      case 'fill':
        return 'fill'
      case 'scale-down':
        return 'scale-down'
    }
  }

  if (style.resizeMode) {
    switch (style.resizeMode) {
      case 'cover':
        return 'cover'
      case 'contain':
        return 'contain'
      case 'stretch':
        return 'fill'
      case 'center':
        return 'center'
      case 'repeat':
        return 'repeat'
    }
  }

  return 'cover' // Default
}

function computeDestRect(
  fit: FitMode,
  imgW: number,
  imgH: number,
  x: number,
  y: number,
  w: number,
  h: number,
): Float32Array {
  switch (fit) {
    case 'fill': {
      // Stretch to fill the entire rect
      return Float32Array.from([x, y, x + w, y + h])
    }

    case 'contain': {
      // Scale proportionally to fit entirely within the rect
      const scale = Math.min(w / imgW, h / imgH)
      const dw = imgW * scale
      const dh = imgH * scale
      const dx = x + (w - dw) / 2
      const dy = y + (h - dh) / 2
      return Float32Array.from([dx, dy, dx + dw, dy + dh])
    }

    case 'cover': {
      // Scale proportionally to cover the entire rect (may crop)
      const scale = Math.max(w / imgW, h / imgH)
      const dw = imgW * scale
      const dh = imgH * scale
      const dx = x + (w - dw) / 2
      const dy = y + (h - dh) / 2
      return Float32Array.from([dx, dy, dx + dw, dy + dh])
    }

    case 'center': {
      // No scaling, center the image
      const dx = x + (w - imgW) / 2
      const dy = y + (h - imgH) / 2
      return Float32Array.from([dx, dy, dx + imgW, dy + imgH])
    }

    case 'scale-down': {
      // Like contain, but only scale down, never up
      const scale = Math.min(1, Math.min(w / imgW, h / imgH))
      const dw = imgW * scale
      const dh = imgH * scale
      const dx = x + (w - dw) / 2
      const dy = y + (h - dh) / 2
      return Float32Array.from([dx, dy, dx + dw, dy + dh])
    }

    case 'repeat': {
      // For repeat, dest rect doesn't apply (handled separately)
      return Float32Array.from([x, y, x + imgW, y + imgH])
    }

    default:
      return Float32Array.from([x, y, x + w, y + h])
  }
}

// =============================================================================
// Repeat drawing
// =============================================================================

function drawRepeatedImage(
  ck: CanvasKit,
  canvas: Canvas,
  image: Image,
  paint: InstanceType<typeof ck.Paint>,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  const imgW = image.width()
  const imgH = image.height()
  if (imgW <= 0 || imgH <= 0) return

  // Clip to the view area
  canvas.save()
  canvas.clipRect(Float32Array.from([x, y, x + w, y + h]), ck.ClipOp.Intersect, true)

  const srcRect = Float32Array.from([0, 0, imgW, imgH])

  for (let ty = y; ty < y + h; ty += imgH) {
    for (let tx = x; tx < x + w; tx += imgW) {
      const destRect = Float32Array.from([tx, ty, tx + imgW, ty + imgH])
      canvas.drawImageRect(image, srcRect, destRect, paint)
    }
  }

  canvas.restore()
}

// =============================================================================
// Tint color filter
// =============================================================================

function makeTintColorFilter(
  ck: CanvasKit,
  tintColor: ColorValue,
): ReturnType<typeof ck.ColorFilter.MakeBlend> | null {
  const color = toColor(ck, tintColor)
  return ck.ColorFilter.MakeBlend(color, ck.BlendMode.SrcIn)
}
