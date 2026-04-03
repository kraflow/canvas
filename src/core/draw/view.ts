import type { Canvas, CanvasKit } from 'canvaskit-wasm'
import type { ViewStyle } from '@/core/styles'
import type { Rect, ScrollPosition } from './types'
import type { ViewContext } from './context'

/**
 * Draws a View constraint. Uses an explicitly provided ViewContext
 * to avoid memory leaks while allowing dynamic real-time style updates.
 */
export function view(
  ck: CanvasKit,
  canvas: Canvas,
  ctx: ViewContext,
  style: ViewStyle,
  rect: Rect,
  scrollPosition?: ScrollPosition,
) {
  const hasOpacityOrBlend =
    (style.opacity !== undefined && style.opacity < 1) ||
    (style.mixBlendMode && style.mixBlendMode !== 'normal')
  const hasTransform = Array.isArray(style.transform) && style.transform.length > 0
  const hasFilter = Array.isArray(style.filter) && style.filter.length > 0
  const needsGlobalSave = hasOpacityOrBlend || hasTransform || hasFilter

  // 1. Layer, Transforms, and Filters
  if (needsGlobalSave) {
    if (hasOpacityOrBlend || hasFilter) {
      if (!ctx.layerPaint) ctx.layerPaint = new ck.Paint()
      ctx.layerPaint.setAlphaf(style.opacity !== undefined ? style.opacity : 1)

      if (hasFilter) {
        let composedFilter: import('canvaskit-wasm').ImageFilter | null = null
        ;(style.filter as { blur?: string | number }[]).forEach((f) => {
          if ('blur' in f) {
            const val = parseFloat(f.blur as string) || 0
            const filter = ck.ImageFilter.MakeBlur(val, val, ck.TileMode.Decal, null)
            composedFilter = composedFilter
              ? ck.ImageFilter.MakeCompose(filter, composedFilter)
              : filter
          }
          // Note: Add grayscale/brightness/etc. via ColorMatrix here later if required
        })
        if (composedFilter) ctx.layerPaint.setImageFilter(composedFilter)
      } else {
        ctx.layerPaint.setImageFilter(null)
      }

      canvas.saveLayer(ctx.layerPaint)
    } else {
      canvas.save()
    }
  } else if (ctx.layerPaint) {
    ctx.layerPaint.delete()
    ctx.layerPaint = null
  }

  if (hasTransform) {
    const originX = rect.x + rect.width / 2
    const originY = rect.y + rect.height / 2
    canvas.translate(originX, originY)
    style.transform!.forEach((t) => {
      if ('translateX' in t) canvas.translate(parseFloat(t.translateX as string) || 0, 0)
      if ('translateY' in t) canvas.translate(0, parseFloat(t.translateY as string) || 0)
      if ('scale' in t) canvas.scale(t.scale, t.scale)
      if ('scaleX' in t) canvas.scale(t.scaleX, 1)
      if ('scaleY' in t) canvas.scale(1, t.scaleY)
      if ('rotate' in t) canvas.rotate(parseFloat(t.rotate as string) || 0, 0, 0)
    })
    canvas.translate(-originX, -originY)
  }

  // 2. Background Paint Management
  if (style.backgroundColor && style.backgroundColor !== 'transparent') {
    if (!ctx.bgPaint) {
      ctx.bgPaint = new ck.Paint()
      ctx.bgPaint.setStyle(ck.PaintStyle.Fill)
      ctx.bgPaint.setAntiAlias(true)
    }
    const color = ck.parseColorString(style.backgroundColor) || ck.Color4f(0, 0, 0, 0)
    if (color) ctx.bgPaint.setColor(color)
  } else if (ctx.bgPaint) {
    ctx.bgPaint.delete()
    ctx.bgPaint = null
  }

  // 3. Border Paint Management
  if (
    style.borderWidth &&
    style.borderColor &&
    style.borderWidth > 0 &&
    style.borderColor !== 'transparent'
  ) {
    if (!ctx.borderPaint) {
      ctx.borderPaint = new ck.Paint()
      ctx.borderPaint.setStyle(ck.PaintStyle.Stroke)
      ctx.borderPaint.setAntiAlias(true)
    }
    ctx.borderPaint.setStrokeWidth(style.borderWidth)
    const color = ck.parseColorString(style.borderColor) || ck.Color4f(0, 0, 0, 1)
    if (color) ctx.borderPaint.setColor(color)

    if (style.borderStyle === 'dashed' || style.borderStyle === 'dotted') {
      const onLen = style.borderStyle === 'dashed' ? style.borderWidth * 3 : style.borderWidth
      const offLen = style.borderStyle === 'dashed' ? style.borderWidth * 3 : style.borderWidth * 2
      ctx.borderPaint.setPathEffect(ck.PathEffect.MakeDash([onLen, offLen], 0))
    } else {
      ctx.borderPaint.setPathEffect(null)
    }
  } else if (ctx.borderPaint) {
    ctx.borderPaint.delete()
    ctx.borderPaint = null
  }

  // 4a. Legacy Shadow Paint Management
  if (style.shadowColor && style.shadowOpacity && style.shadowOpacity > 0) {
    if (!ctx.shadowPaint) ctx.shadowPaint = new ck.Paint()
    const baseCol = ck.parseColorString(style.shadowColor) || ck.Color4f(0, 0, 0, 1)
    baseCol[3] = style.shadowOpacity
    const offsetX = style.shadowOffset?.width || 0
    const offsetY = style.shadowOffset?.height || 0
    const blurRadius = style.shadowRadius || 0
    ctx.shadowPaint.setImageFilter(
      ck.ImageFilter.MakeDropShadow(offsetX, offsetY, blurRadius, blurRadius, baseCol, null),
    )
  } else if (ctx.shadowPaint) {
    ctx.shadowPaint.delete()
    ctx.shadowPaint = null
  }

  // 4b. Modern Box Shadow Lists
  if (Array.isArray(style.boxShadow) && style.boxShadow.length > 0) {
    if (!ctx.shadowPaints) ctx.shadowPaints = []

    if (ctx.shadowPaints.length > style.boxShadow.length) {
      const extra = ctx.shadowPaints.splice(style.boxShadow.length)
      extra.forEach((p) => p.delete())
    }

    style.boxShadow.forEach((shadowItem, idx) => {
      let p = ctx.shadowPaints![idx]
      if (!p) {
        p = new ck.Paint()
        p.setStyle(ck.PaintStyle.Fill)
        p.setAntiAlias(true)
        ctx.shadowPaints![idx] = p
      }

      if (typeof shadowItem === 'string') return // Advanced string parsing skipped
      const parsedColor = ck.parseColorString(shadowItem.color || 'black') || ck.Color4f(0, 0, 0, 1)
      p.setColor(parsedColor)

      const blurStr = shadowItem.blurRadius || 0
      const blur = parseFloat(blurStr as string) || 0
      if (blur > 0) p.setMaskFilter(ck.MaskFilter.MakeBlur(ck.BlurStyle.Normal, blur, true))
      else p.setMaskFilter(null)
    })
  } else if (ctx.shadowPaints) {
    ctx.shadowPaints.forEach((p) => p.delete())
    ctx.shadowPaints = []
  }

  // 5. Outline Paint Management
  if (
    style.outlineWidth &&
    style.outlineColor &&
    style.outlineWidth > 0 &&
    style.outlineColor !== 'transparent'
  ) {
    if (!ctx.outlinePaint) {
      ctx.outlinePaint = new ck.Paint()
      ctx.outlinePaint.setStyle(ck.PaintStyle.Stroke)
      ctx.outlinePaint.setAntiAlias(true)
    }
    ctx.outlinePaint.setStrokeWidth(style.outlineWidth)
    const color = ck.parseColorString(style.outlineColor) || ck.Color4f(0, 0, 0, 1)
    if (color) ctx.outlinePaint.setColor(color)

    if (style.outlineStyle === 'dashed' || style.outlineStyle === 'dotted') {
      const onLen = style.outlineStyle === 'dashed' ? style.outlineWidth * 3 : style.outlineWidth
      const offLen =
        style.outlineStyle === 'dashed' ? style.outlineWidth * 3 : style.outlineWidth * 2
      ctx.outlinePaint.setPathEffect(ck.PathEffect.MakeDash([onLen, offLen], 0))
    } else {
      ctx.outlinePaint.setPathEffect(null)
    }
  } else if (ctx.outlinePaint) {
    ctx.outlinePaint.delete()
    ctx.outlinePaint = null
  }

  // --- Drawing logic ---
  const bounds = ck.LTRBRect(rect.x, rect.y, rect.x + rect.width, rect.y + rect.height)

  const tl = style.borderTopLeftRadius ?? style.borderStartStartRadius ?? style.borderRadius ?? 0
  const tr = style.borderTopRightRadius ?? style.borderStartEndRadius ?? style.borderRadius ?? 0
  const br = style.borderBottomRightRadius ?? style.borderEndEndRadius ?? style.borderRadius ?? 0
  const bl = style.borderBottomLeftRadius ?? style.borderEndStartRadius ?? style.borderRadius ?? 0

  let rrect: Float32Array | number[] | null = null
  if (tl > 0 || tr > 0 || br > 0 || bl > 0) {
    if (tl === tr && tr === br && br === bl) {
      rrect = ck.RRectXY(bounds, tl, tl)
    } else {
      rrect = [
        rect.x,
        rect.y,
        rect.x + rect.width,
        rect.y + rect.height,
        tl,
        tl,
        tr,
        tr,
        br,
        br,
        bl,
        bl,
      ]
    }
  }

  if (ctx.shadowPaint) {
    if (rrect) canvas.drawRRect(rrect, ctx.shadowPaint)
    else canvas.drawRect(bounds, ctx.shadowPaint)
  }

  if (ctx.shadowPaints && Array.isArray(style.boxShadow)) {
    ctx.shadowPaints.forEach((p, idx) => {
      const shadow = style.boxShadow![idx]
      if (!shadow || typeof shadow === 'string' || shadow.inset) return // Not supported simply atm

      canvas.save()
      const dx = parseFloat(shadow.offsetX as string) || 0
      const dy = parseFloat(shadow.offsetY as string) || 0
      canvas.translate(dx, dy)

      const spread = parseFloat(shadow.spreadDistance as string) || 0
      if (spread !== 0) {
        // Highly simplified bound inflation via scaling rather than specific RRect math recalculations
        const cx = rect.x + rect.width / 2
        const cy = rect.y + rect.height / 2
        canvas.translate(cx, cy)
        canvas.scale(1 + (spread * 2) / rect.width, 1 + (spread * 2) / rect.height)
        canvas.translate(-cx, -cy)
      }

      if (rrect) canvas.drawRRect(rrect, p)
      else canvas.drawRect(bounds, p)

      canvas.restore()
    })
  }

  if (ctx.bgPaint) {
    if (rrect) canvas.drawRRect(rrect, ctx.bgPaint)
    else canvas.drawRect(bounds, ctx.bgPaint)
  }
  if (ctx.borderPaint) {
    if (rrect) canvas.drawRRect(rrect, ctx.borderPaint)
    else canvas.drawRect(bounds, ctx.borderPaint)
  }

  // 6. Draw Outlines
  if (ctx.outlinePaint) {
    const offset = style.outlineOffset || 0
    const ow = style.outlineWidth || 0
    const expand = offset + ow / 2 // Stroke draws centered, so we push it out
    const outBounds = ck.LTRBRect(
      rect.x - expand,
      rect.y - expand,
      rect.x + rect.width + expand,
      rect.y + rect.height + expand,
    )
    canvas.drawRect(outBounds, ctx.outlinePaint)
  }

  // 7. Clip boundaries
  const isScrollOrHidden = style.overflow === 'scroll' || style.overflow === 'hidden'
  if (isScrollOrHidden) {
    canvas.save()
    if (rrect) canvas.clipRRect(rrect, ck.ClipOp.Intersect, true)
    else canvas.clipRect(bounds, ck.ClipOp.Intersect, true)

    if (scrollPosition) canvas.translate(-scrollPosition.x, -scrollPosition.y)
  }
}

export function restoreView(canvas: Canvas, style: ViewStyle) {
  const isScrollOrHidden = style.overflow === 'scroll' || style.overflow === 'hidden'
  if (isScrollOrHidden) {
    canvas.restore()
  }

  const hasOpacityOrBlend =
    (style.opacity !== undefined && style.opacity < 1) ||
    (style.mixBlendMode && style.mixBlendMode !== 'normal')
  const hasTransform = Array.isArray(style.transform) && style.transform.length > 0
  if (hasOpacityOrBlend || hasTransform) {
    canvas.restore()
  }
}
