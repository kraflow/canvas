import type { Canvas, CanvasKit, FontMgr, Image, Paragraph } from 'canvaskit-wasm'
import type {
  ResolvedViewStyle,
  ResolvedTextStyle,
  ResolvedImageStyle,
  ResolvedRadius,
} from '../styles/StyleResolver'

/* ============================================================
 * Layout rect — result from YogaLayout
 * ============================================================ */
export interface LayoutRect {
  x: number
  y: number
  w: number
  h: number
}

/* ============================================================
 * Internal draw helpers
 * These live here because they operate purely on resolved values
 * — no style parsing at all.
 * ============================================================ */

const BEZIER_K = 0.5523 // cubic bezier quarter-circle approximation

function buildRoundedRectPath(
  ck: CanvasKit,
  x: number,
  y: number,
  w: number,
  h: number,
  { tl, tr, br, bl }: ResolvedRadius,
): InstanceType<CanvasKit['Path']> {
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

function drawRRect(
  canvas: Canvas,
  ck: CanvasKit,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: ResolvedRadius,
  paint: InstanceType<CanvasKit['Paint']>,
) {
  if (radius.isUniform) {
    canvas.drawRRect(ck.RRectXY(ck.XYWHRect(x, y, w, h), radius.tl, radius.tl), paint)
    return
  }
  const path = buildRoundedRectPath(ck, x, y, w, h, radius)
  canvas.drawPath(path, paint)
  path.delete()
}

function applyClip(
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
  paint: InstanceType<CanvasKit['Paint']>,
  style: 'solid' | 'dashed' | 'dotted',
  strokeWidth: number,
) {
  if (style === 'dashed') {
    paint.setPathEffect(ck.PathEffect.MakeDash([strokeWidth * 3, strokeWidth * 2]))
  } else if (style === 'dotted') {
    paint.setPathEffect(ck.PathEffect.MakeDash([strokeWidth, strokeWidth]))
  }
}

/* ============================================================
 * renderView — pure draw calls, zero style parsing
 * ============================================================ */
export function renderView(
  canvas: Canvas,
  ck: CanvasKit,
  layout: LayoutRect,
  rs: ResolvedViewStyle,
): void {
  const { x, y, w, h } = layout

  // --- saveLayer for opacity / blend mode ---
  if (rs.needsLayer) {
    const lp = new ck.Paint()
    lp.setAlphaf(rs.opacity)
    if (rs.blendModeValue !== null) lp.setBlendMode({ value: rs.blendModeValue } as never)
    canvas.saveLayer(lp)
    lp.delete()
  } else {
    canvas.save()
  }

  // --- outset box shadows ---
  for (const sh of rs.outsetShadows) {
    const p = new ck.Paint()
    p.setColor(sh.color)
    p.setStyle(ck.PaintStyle.Fill)
    if (sh.blurRadius > 0)
      p.setMaskFilter(ck.MaskFilter.MakeBlur(ck.BlurStyle.Normal, sh.blurRadius / 2, false))
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
    p.delete()
  }

  // --- legacy iOS shadow ---
  if (rs.legacyShadow) {
    const { color, offsetX, offsetY, radius: blur } = rs.legacyShadow
    const p = new ck.Paint()
    p.setColor(color)
    p.setStyle(ck.PaintStyle.Fill)
    if (blur > 0) p.setMaskFilter(ck.MaskFilter.MakeBlur(ck.BlurStyle.Normal, blur / 2, false))
    drawRRect(canvas, ck, x + offsetX, y + offsetY, w, h, rs.radius, p)
    p.delete()
  }

  // --- Android elevation ---
  if (rs.elevation > 0 && !rs.legacyShadow && rs.outsetShadows.length === 0) {
    const p = new ck.Paint()
    p.setColor(ck.Color4f(0, 0, 0, 0.24))
    p.setStyle(ck.PaintStyle.Fill)
    p.setMaskFilter(ck.MaskFilter.MakeBlur(ck.BlurStyle.Normal, rs.elevation * 0.5, false))
    drawRRect(canvas, ck, x + 1, y + rs.elevation * 0.5, w, h, rs.radius, p)
    p.delete()
  }

  // --- overflow clip ---
  if (rs.clipContent) applyClip(canvas, ck, x, y, w, h, rs.radius)

  // --- background ---
  if (rs.backgroundColor) {
    const p = new ck.Paint()
    p.setColor(rs.backgroundColor)
    p.setStyle(ck.PaintStyle.Fill)
    p.setAntiAlias(true)
    drawRRect(canvas, ck, x, y, w, h, rs.radius, p)
    p.delete()
  }

  // --- inset shadows ---
  for (const sh of rs.insetShadows) {
    canvas.save()
    applyClip(canvas, ck, x, y, w, h, rs.radius)
    const p = new ck.Paint()
    p.setColor(sh.color)
    p.setStyle(ck.PaintStyle.Stroke)
    p.setStrokeWidth(sh.blurRadius * 2 + sh.spreadDistance * 2)
    if (sh.blurRadius > 0)
      p.setMaskFilter(ck.MaskFilter.MakeBlur(ck.BlurStyle.Normal, sh.blurRadius / 2, false))
    drawRRect(canvas, ck, x + sh.offsetX, y + sh.offsetY, w, h, rs.radius, p)
    p.delete()
    canvas.restore()
  }

  // --- borders ---
  const { border, radius } = rs

  if (border.isUniform && border.topWidth > 0) {
    const p = new ck.Paint()
    p.setColor(border.topColor)
    p.setStyle(ck.PaintStyle.Stroke)
    p.setStrokeWidth(border.topWidth)
    p.setAntiAlias(true)
    applyBorderDash(ck, p, border.style, border.topWidth)
    const inset = border.topWidth / 2
    drawRRect(canvas, ck, x + inset, y + inset, w - border.topWidth, h - border.topWidth, radius, p)
    p.delete()
  } else {
    const drawSide = (
      x1: number,
      y1: number,
      x2: number,
      y2: number,
      bw: number,
      color: Float32Array,
    ) => {
      if (!bw) return
      const p = new ck.Paint()
      p.setColor(color)
      p.setStyle(ck.PaintStyle.Stroke)
      p.setStrokeWidth(bw)
      p.setAntiAlias(true)
      applyBorderDash(ck, p, border.style, bw)
      canvas.drawLine(x1, y1, x2, y2, p)
      p.delete()
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
    const p = new ck.Paint()
    p.setColor(color)
    p.setStyle(ck.PaintStyle.Stroke)
    p.setStrokeWidth(width)
    p.setAntiAlias(true)
    applyBorderDash(ck, p, style as 'solid' | 'dashed' | 'dotted', width)
    const expand = width / 2 + offset
    drawRRect(canvas, ck, x - expand, y - expand, w + expand * 2, h + expand * 2, radius, p)
    p.delete()
  }

  canvas.restore()
}

/* ============================================================
 * renderText — zero style parsing, uses pre-resolved ParagraphStyle fields
 * ============================================================ */
export function createAndLayoutParagraph(
  ck: CanvasKit,
  fontMgr: FontMgr,
  rs: ResolvedTextStyle,
  content: string,
  availableWidth: number, // width constraint from Yoga
): { paragraph: Paragraph; textHeight: number; longestLine: number } {
  // Apply textTransform (same as in renderText)
  let text = content
  switch (rs.textTransform) {
    case 'uppercase':
      text = content.toUpperCase()
      break
    case 'lowercase':
      text = content.toLowerCase()
      break
    case 'capitalize':
      text = content.replace(/\b\w/g, (c) => c.toUpperCase())
      break
    default:
      text = content
  }

  const paraStyle = new ck.ParagraphStyle({
    textAlign: { value: rs.textAlignValue } as never,
    textStyle: {
      color: rs.color, // color not used for measure, but harmless
      fontFamilies: rs.fontFamilies,
      fontSize: rs.fontSize,
      fontStyle: {
        weight: { value: rs.fontWeight },
        slant: rs.italic ? ck.FontSlant.Italic : ck.FontSlant.Upright,
      },
      letterSpacing: rs.letterSpacing,
      heightMultiplier: rs.heightMultiplier,
      decoration: rs.decoration,
      decorationStyle: rs.decorationStyle,
      decorationColor: rs.decorationColor,
      shadows: rs.textShadow
        ? [
            {
              color: rs.textShadow.color,
              offset: [rs.textShadow.offsetX, rs.textShadow.offsetY] as [number, number],
              blurRadius: rs.textShadow.blurRadius,
            },
          ]
        : undefined,
      fontFeatures: rs.fontFeatures,
    },
    textDirection: rs.textDirectionRTL ? ck.TextDirection.RTL : ck.TextDirection.LTR,
  })

  const builder = ck.ParagraphBuilder.Make(paraStyle, fontMgr)
  builder.addText(text)
  const para = builder.build()

  para.layout(availableWidth) // This is the key for wrapping

  const textHeight = para.getHeight()
  const longestLine = para.getLongestLine() // useful for intrinsic width

  // Clean up builder immediately (paragraph is returned)
  builder.delete()

  return { paragraph: para, textHeight, longestLine }
}

export function renderText(
  canvas: Canvas,
  ck: CanvasKit,
  fontMgr: FontMgr,
  layout: LayoutRect,
  rs: ResolvedTextStyle,
  content: string,
): void {
  const { x, y, w, h } = layout

  renderView(canvas, ck, layout, rs) // background box

  canvas.save()
  if (rs.clipContent) applyClip(canvas, ck, x, y, w, h, rs.radius)

  const { paragraph, textHeight } = createAndLayoutParagraph(ck, fontMgr, rs, content, w)

  let textY = y
  if (rs.textAlignVertical === 'center') textY = y + (h - textHeight) / 2
  else if (rs.textAlignVertical === 'bottom') textY = y + h - textHeight

  canvas.drawParagraph(paragraph, x, textY)

  paragraph.delete() // important!
  canvas.restore()
}

/* ============================================================
 * renderImage — zero style parsing
 * ============================================================ */
export function renderImage(
  canvas: Canvas,
  ck: CanvasKit,
  layout: LayoutRect,
  rs: ResolvedImageStyle,
  image: Image,
): void {
  const { x, y, w, h } = layout

  renderView(canvas, ck, layout, rs)

  canvas.save()
  applyClip(canvas, ck, x, y, w, h, rs.radius)

  const imgW = image.width()
  const imgH = image.height()

  let dx = x,
    dy = y,
    dw = w,
    dh = h

  if (rs.mode !== 'stretch' && rs.mode !== 'fill' && rs.mode !== 'repeat') {
    if (rs.mode === 'center') {
      dw = imgW
      dh = imgH
      dx = x + (w - imgW) / 2
      dy = y + (h - imgH) / 2
    } else {
      const scaleX = w / imgW
      const scaleY = h / imgH
      const scale =
        rs.mode === 'cover'
          ? Math.max(scaleX, scaleY)
          : rs.mode === 'scale-down'
            ? Math.min(Math.min(scaleX, scaleY), 1)
            : Math.min(scaleX, scaleY) // contain
      dw = imgW * scale
      dh = imgH * scale
      dx = x + (w - dw) / 2
      dy = y + (h - dh) / 2
    }
  }

  const imagePaint = new ck.Paint()
  imagePaint.setAlphaf(rs.opacity)

  if (rs.hasTint && rs.tintColor) {
    imagePaint.setColorFilter(ck.ColorFilter.MakeBlend(rs.tintColor, ck.BlendMode.SrcIn))
  }

  if (rs.mode === 'repeat') {
    const shader = image.makeShaderOptions(
      ck.TileMode.Repeat,
      ck.TileMode.Repeat,
      ck.FilterMode.Linear,
      ck.MipmapMode.None,
    )
    const fp = new ck.Paint()
    fp.setShader(shader)
    canvas.drawRect(ck.XYWHRect(x, y, w, h), fp)
    fp.delete()
    shader.delete()
  } else {
    canvas.drawImageRect(
      image,
      ck.XYWHRect(0, 0, imgW, imgH),
      ck.XYWHRect(dx, dy, dw, dh),
      imagePaint,
      false,
    )
  }

  imagePaint.delete()
  canvas.restore()
}
