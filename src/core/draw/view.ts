import type { Canvas, CanvasKit } from 'canvaskit-wasm'
import type { ViewStyle } from '@/core/styles'
import type { Rect, ScrollPosition, ScratchPaints } from './types'
import type { ViewContext } from './context'

/**
 * Draws a View constraint. Uses global ScratchPaints
 * to avoid memory leaks while allowing dynamic real-time style updates.
 */
export function view(
  ck: CanvasKit,
  canvas: Canvas,
  ctx: ViewContext,
  style: ViewStyle,
  rect: Rect,
  scrollPosition: ScrollPosition | undefined,
  paints: ScratchPaints,
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
      paints.layer.setAlphaf(style.opacity !== undefined ? style.opacity : 1)

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
        paints.layer.setImageFilter(composedFilter)
      } else {
        paints.layer.setImageFilter(null)
      }

      canvas.saveLayer(paints.layer)
    } else {
      canvas.save()
    }
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

  // --- Geometry computation ---
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

  // --- Shadow Drawing ---
  if (style.shadowColor && style.shadowOpacity && style.shadowOpacity > 0) {
    const baseCol = ck.parseColorString(style.shadowColor) || ck.Color4f(0, 0, 0, 1)
    baseCol[3] = style.shadowOpacity
    const offsetX = style.shadowOffset?.width || 0
    const offsetY = style.shadowOffset?.height || 0
    const blurRadius = style.shadowRadius || 0
    paints.shadow.setImageFilter(
      ck.ImageFilter.MakeDropShadow(offsetX, offsetY, blurRadius, blurRadius, baseCol, null),
    )
    paints.shadow.setMaskFilter(null) // reset mask filter

    if (rrect) canvas.drawRRect(rrect, paints.shadow)
    else canvas.drawRect(bounds, paints.shadow)
  }

  if (Array.isArray(style.boxShadow) && style.boxShadow.length > 0) {
    paints.shadow.setImageFilter(null) // reset image filter before using mask filter mapping

    style.boxShadow.forEach((shadowItem) => {
      if (!shadowItem || typeof shadowItem === 'string' || shadowItem.inset) return

      const parsedColor = ck.parseColorString(shadowItem.color || 'black') || ck.Color4f(0, 0, 0, 1)
      paints.shadow.setColor(parsedColor)

      const blurStr = shadowItem.blurRadius || 0
      const blur = parseFloat(blurStr as string) || 0
      if (blur > 0)
        paints.shadow.setMaskFilter(ck.MaskFilter.MakeBlur(ck.BlurStyle.Normal, blur, true))
      else paints.shadow.setMaskFilter(null)

      canvas.save()
      const dx = parseFloat(shadowItem.offsetX as string) || 0
      const dy = parseFloat(shadowItem.offsetY as string) || 0
      canvas.translate(dx, dy)

      const spread = parseFloat(shadowItem.spreadDistance as string) || 0
      if (spread !== 0) {
        const cx = rect.x + rect.width / 2
        const cy = rect.y + rect.height / 2
        canvas.translate(cx, cy)
        canvas.scale(1 + (spread * 2) / rect.width, 1 + (spread * 2) / rect.height)
        canvas.translate(-cx, -cy)
      }

      if (rrect) canvas.drawRRect(rrect, paints.shadow)
      else canvas.drawRect(bounds, paints.shadow)

      canvas.restore()
    })
  }

  // --- Background Drawing ---
  if (style.backgroundColor && style.backgroundColor !== 'transparent') {
    const color = ck.parseColorString(style.backgroundColor) || ck.Color4f(0, 0, 0, 0)
    paints.fill.setColor(color)
    if (rrect) canvas.drawRRect(rrect, paints.fill)
    else canvas.drawRect(bounds, paints.fill)
  }

  // --- Border Drawing ---
  if (
    style.borderWidth &&
    style.borderColor &&
    style.borderWidth > 0 &&
    style.borderColor !== 'transparent'
  ) {
    paints.stroke.setStrokeWidth(style.borderWidth)
    const color = ck.parseColorString(style.borderColor) || ck.Color4f(0, 0, 0, 1)
    paints.stroke.setColor(color)

    if (style.borderStyle === 'dashed' || style.borderStyle === 'dotted') {
      const onLen = style.borderStyle === 'dashed' ? style.borderWidth * 3 : style.borderWidth
      const offLen = style.borderStyle === 'dashed' ? style.borderWidth * 3 : style.borderWidth * 2
      paints.stroke.setPathEffect(ck.PathEffect.MakeDash([onLen, offLen], 0))
    } else {
      paints.stroke.setPathEffect(null)
    }

    if (rrect) canvas.drawRRect(rrect, paints.stroke)
    else canvas.drawRect(bounds, paints.stroke)
  }

  // --- Outline Drawing ---
  if (
    style.outlineWidth &&
    style.outlineColor &&
    style.outlineWidth > 0 &&
    style.outlineColor !== 'transparent'
  ) {
    paints.stroke.setStrokeWidth(style.outlineWidth)
    const color = ck.parseColorString(style.outlineColor) || ck.Color4f(0, 0, 0, 1)
    paints.stroke.setColor(color)

    if (style.outlineStyle === 'dashed' || style.outlineStyle === 'dotted') {
      const onLen = style.outlineStyle === 'dashed' ? style.outlineWidth * 3 : style.outlineWidth
      const offLen =
        style.outlineStyle === 'dashed' ? style.outlineWidth * 3 : style.outlineWidth * 2
      paints.stroke.setPathEffect(ck.PathEffect.MakeDash([onLen, offLen], 0))
    } else {
      paints.stroke.setPathEffect(null)
    }

    const offset = style.outlineOffset || 0
    const ow = style.outlineWidth || 0
    const expand = offset + ow / 2 // Stroke draws centered, so we push it out
    const outBounds = ck.LTRBRect(
      rect.x - expand,
      rect.y - expand,
      rect.x + rect.width + expand,
      rect.y + rect.height + expand,
    )
    canvas.drawRect(outBounds, paints.stroke)
  }

  // --- Clip boundaries ---
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
  const hasFilter = Array.isArray(style.filter) && style.filter.length > 0
  if (hasOpacityOrBlend || hasTransform || hasFilter) {
    canvas.restore()
  }
}
