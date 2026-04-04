import type {
  Canvas,
  CanvasKit,
  ImageFilter,
  MaskFilter,
  Paint,
  Path,
  PathEffect,
} from 'canvaskit-wasm'
import type { ResolvedViewStyle, ResolvedRadius } from '@/core/styles'
import type { ScrollPosition, LayoutRectRect, ScratchPaints } from './types'

const BEZIER_K = 0.5523

export function buildRoundedRectPath(
  ck: CanvasKit,
  x: number,
  y: number,
  w: number,
  h: number,
  { tl, tr, br, bl }: ResolvedRadius,
): Path {
  const k = BEZIER_K
  const path = new ck.PathBuilder()
  path.moveTo(x + tl, y)
  path.lineTo(x + w - tr, y)
  path.cubicTo(x + w - tr * (1 - k), y, x + w, y + tr * (1 - k), x + w, y + tr)
  path.lineTo(x + w, y + h - br)
  path.cubicTo(x + w, y + h - br * (1 - k), x + w - br * (1 - k), y + h, x + w - br, y + h)
  path.lineTo(x + bl, y + h)
  path.cubicTo(x + bl * (1 - k), y + h, x, y + h - bl * (1 - k), x, y + h - bl)
  path.lineTo(x, y + tl)
  path.cubicTo(x, y + tl * (1 - k), x + tl * (1 - k), y, x + tl, y)
  path.close()

  const result = path.snapshot()
  path.delete()
  return result
}

export function drawRRect(
  canvas: Canvas,
  ck: CanvasKit,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: ResolvedRadius,
  paint: Paint,
) {
  if (radius.isUniform) {
    canvas.drawRRect(ck.RRectXY(ck.XYWHRect(x, y, w, h), radius.tl, radius.tl), paint)
    return
  }
  const path = buildRoundedRectPath(ck, x, y, w, h, radius)
  canvas.drawPath(path, paint)
  path.delete()
}

export function applyClip(
  canvas: Canvas,
  ck: CanvasKit,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: ResolvedRadius,
) {
  canvas.clipRRect(
    ck.RRectXY(ck.XYWHRect(x, y, w, h), radius.tl, radius.tl),
    ck.ClipOp.Intersect,
    true,
  )
}

function applyBorderDash(
  ck: CanvasKit,
  paint: Paint,
  style: 'solid' | 'dashed' | 'dotted',
  strokeWidth: number,
): PathEffect | null {
  let effect: PathEffect | null = null
  if (style === 'dashed') {
    effect = ck.PathEffect.MakeDash([strokeWidth * 3, strokeWidth * 2])
    paint.setPathEffect(effect)
  } else if (style === 'dotted') {
    effect = ck.PathEffect.MakeDash([strokeWidth, strokeWidth])
    paint.setPathEffect(effect)
  }
  return effect
}

export function view(
  ck: CanvasKit,
  canvas: Canvas,
  rs: ResolvedViewStyle,
  rect: LayoutRectRect,
  scrollPosition: ScrollPosition | undefined,
  paints: ScratchPaints,
) {
  if (!rs.display) return

  const { x, y, w, h } = rect

  // --- saveLayer for opacity / blend mode / visual filters ---
  const willSaveLayer = rs.needsLayer || rs.filterEntries !== null || rs.transform

  if (rs.needsLayer || rs.filterEntries !== null) {
    paints.layer.setAlphaf(rs.opacity)
    paints.layer.setBlendMode(ck.BlendMode.Clear)
    if (rs.blendModeValue !== null) paints.layer.setBlendMode({ value: rs.blendModeValue } as never)

    const layerFiltersToClean: ImageFilter[] = []
    if (rs.filterEntries) {
      let currentFilter: ImageFilter | null = null
      for (const f of rs.filterEntries) {
        if (f.blur) {
          const newBlur = ck.ImageFilter.MakeBlur(f.blur, f.blur, ck.TileMode.Decal, null)
          layerFiltersToClean.push(newBlur)
          if (currentFilter) {
            const composed = ck.ImageFilter.MakeCompose(newBlur, currentFilter)
            layerFiltersToClean.push(composed)
            currentFilter = composed
          } else {
            currentFilter = newBlur
          }
        }
        // TODO: implement other filters
      }
      if (currentFilter) paints.layer.setImageFilter(currentFilter)
    }

    canvas.saveLayer(paints.layer)

    // cleanup C++ objects
    for (const f of layerFiltersToClean) f.delete()
  } else if (willSaveLayer) {
    canvas.save()
  }

  // --- transforms ---
  if (rs.transform) {
    const originX = x + w / 2
    const originY = y + h / 2
    canvas.translate(originX, originY)
    rs.transform.forEach((t) => {
      if ('translateX' in t) canvas.translate(parseFloat(t.translateX as string) || 0, 0)
      if ('translateY' in t) canvas.translate(0, parseFloat(t.translateY as string) || 0)
      if ('scale' in t) canvas.scale(t.scale, t.scale)
      if ('scaleX' in t) canvas.scale(t.scaleX, 1)
      if ('scaleY' in t) canvas.scale(1, t.scaleY)
      if ('rotate' in t) canvas.rotate(parseFloat(t.rotate as string) || 0, 0, 0)
    })
    canvas.translate(-originX, -originY)
  }

  // --- outset box shadows ---
  for (const sh of rs.outsetShadows) {
    const p = paints.shadow
    p.setColor(sh.color)
    p.setStyle(ck.PaintStyle.Fill)
    p.setMaskFilter(null)
    p.setStrokeWidth(sh.blurRadius * 2 + sh.spreadDistance * 2)

    let mask: MaskFilter | null = null
    if (sh.blurRadius > 0) {
      mask = ck.MaskFilter.MakeBlur(ck.BlurStyle.Normal, sh.blurRadius / 2, false)
      p.setMaskFilter(mask)
    }

    drawRRect(
      canvas,
      ck,
      x + sh.offsetX - sh.spreadDistance,
      y + sh.offsetY - sh.spreadDistance,
      w + sh.spreadDistance * 2,
      h + sh.spreadDistance * 2,
      rs.radius,
      p,
    )

    if (mask) mask.delete()
  }

  // --- overflow clip ---
  // (We apply clip here for the background so that content inside overflows correctly later.
  // Note: if scroll exists, we defer child clip logic. But for background, we don't clip here, we clip at end)

  // Actually, background uses RRect directly. We don't need a clip just for background.

  // --- background ---
  if (rs.backgroundColor) {
    const p = paints.fill
    p.setColor(rs.backgroundColor)
    p.setStyle(ck.PaintStyle.Fill)
    p.setAntiAlias(true)
    drawRRect(canvas, ck, x, y, w, h, rs.radius, p)
  }

  // --- inset shadows ---
  for (const sh of rs.insetShadows) {
    canvas.save()
    applyClip(canvas, ck, x, y, w, h, rs.radius)
    const p = paints.shadow
    p.setColor(sh.color)
    p.setStyle(ck.PaintStyle.Stroke)
    p.setStrokeWidth(sh.blurRadius * 2 + sh.spreadDistance * 2)
    p.setMaskFilter(null)
    let mask: MaskFilter | null = null
    if (sh.blurRadius > 0) {
      mask = ck.MaskFilter.MakeBlur(ck.BlurStyle.Normal, sh.blurRadius / 2, false)
      p.setMaskFilter(mask)
    }
    drawRRect(canvas, ck, x + sh.offsetX, y + sh.offsetY, w, h, rs.radius, p)
    if (mask) mask.delete()
    canvas.restore()
  }

  // --- borders ---
  const { border, radius } = rs
  if (border.isUniform && border.topWidth > 0) {
    const p = paints.stroke
    p.setColor(border.topColor)
    p.setStyle(ck.PaintStyle.Stroke)
    p.setStrokeWidth(border.topWidth)
    p.setAntiAlias(true)
    const pe = applyBorderDash(ck, p, border.style, border.topWidth)
    const inset = border.topWidth / 2
    drawRRect(canvas, ck, x + inset, y + inset, w - border.topWidth, h - border.topWidth, radius, p)

    if (pe) pe.delete()
  } else if (!border.isUniform) {
    const drawSide = (
      x1: number,
      y1: number,
      x2: number,
      y2: number,
      bw: number,
      color: Float32Array,
    ) => {
      if (!bw) return
      const p = paints.stroke
      p.setColor(color)
      p.setStyle(ck.PaintStyle.Stroke)
      p.setStrokeWidth(bw)
      p.setAntiAlias(true)
      const pe = applyBorderDash(ck, p, border.style, bw)
      canvas.drawLine(x1, y1, x2, y2, p)

      if (pe) pe.delete()
    }
    drawSide(
      x,
      y + border.topWidth / 2,
      x + w,
      y + border.topWidth / 2,
      border.topWidth,
      border.topColor,
    )
    drawSide(
      x + w - border.rightWidth / 2,
      y,
      x + w - border.rightWidth / 2,
      y + h,
      border.rightWidth,
      border.rightColor,
    )
    drawSide(
      x,
      y + h - border.bottomWidth / 2,
      x + w,
      y + h - border.bottomWidth / 2,
      border.bottomWidth,
      border.bottomColor,
    )
    drawSide(
      x + border.leftWidth / 2,
      y,
      x + border.leftWidth / 2,
      y + h,
      border.leftWidth,
      border.leftColor,
    )
  }

  // --- outline ---
  if (rs.outline) {
    const { color, width, style, offset } = rs.outline
    const p = paints.stroke
    p.setColor(color)
    p.setStyle(ck.PaintStyle.Stroke)
    p.setStrokeWidth(width)
    p.setAntiAlias(true)
    const pe = applyBorderDash(ck, p, style as 'solid' | 'dashed' | 'dotted', width)
    const expand = width / 2 + offset
    drawRRect(canvas, ck, x - expand, y - expand, w + expand * 2, h + expand * 2, radius, p)

    if (pe) pe.delete()
  }

  // --- Clip Content and Scroll offset bounds ---
  if (rs.clipContent) {
    canvas.save()
    applyClip(canvas, ck, x, y, w, h, rs.radius)
    if (scrollPosition) canvas.translate(-scrollPosition.x, -scrollPosition.y)
  }
}

export function restoreView(canvas: Canvas, rs: ResolvedViewStyle) {
  if (!rs.display) return

  if (rs.clipContent) {
    canvas.restore()
  }

  const willSaveLayer = rs.needsLayer || rs.filterEntries !== null || rs.transform
  if (willSaveLayer) {
    canvas.restore()
  }
}
