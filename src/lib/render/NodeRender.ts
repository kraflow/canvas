import type { Canvas, CanvasKit, FontMgr, Image } from 'canvaskit-wasm'
import type { ViewStyle, TextStyle, ImageStyle, Color } from '../styles/types'

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
 * Helpers
 * ============================================================ */

function parseColor(ck: CanvasKit, color: Color): Float32Array {
  const c = color.trim()

  const rgba = c.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)$/)
  if (rgba) {
    return ck.Color4f(
      parseInt(rgba[1]!) / 255,
      parseInt(rgba[2]!) / 255,
      parseInt(rgba[3]!) / 255,
      rgba[4] !== undefined ? parseFloat(rgba[4]) : 1,
    )
  }

  const hsla = c.match(/^hsla?\((\d+),\s*([\d.]+)%,\s*([\d.]+)%(?:,\s*([\d.]+))?\)$/)
  if (hsla) {
    const h = parseInt(hsla[1]!) / 360
    const s = parseFloat(hsla[2]!) / 100
    const l = parseFloat(hsla[3]!) / 100
    const a = hsla[4] !== undefined ? parseFloat(hsla[4]) : 1
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s
    const p = 2 * l - q
    const hue2rgb = (t: number) => {
      if (t < 0) t += 1
      if (t > 1) t -= 1
      if (t < 1 / 6) return p + (q - p) * 6 * t
      if (t < 1 / 2) return q
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
      return p
    }
    return ck.Color4f(hue2rgb(h + 1 / 3), hue2rgb(h), hue2rgb(h - 1 / 3), a)
  }

  if (c.startsWith('#')) {
    const hex = c.slice(1)
    if (hex.length === 3) {
      const [r, g, b] = hex.split('').map((x) => parseInt(x + x, 16) / 255)
      return ck.Color4f(r!, g!, b!, 1)
    }
    if (hex.length === 6) {
      return ck.Color4f(
        parseInt(hex.slice(0, 2), 16) / 255,
        parseInt(hex.slice(2, 4), 16) / 255,
        parseInt(hex.slice(4, 6), 16) / 255,
        1,
      )
    }
    if (hex.length === 8) {
      return ck.Color4f(
        parseInt(hex.slice(0, 2), 16) / 255,
        parseInt(hex.slice(2, 4), 16) / 255,
        parseInt(hex.slice(4, 6), 16) / 255,
        parseInt(hex.slice(6, 8), 16) / 255,
      )
    }
  }

  const named: Record<string, Float32Array> = {
    transparent: ck.Color4f(0, 0, 0, 0),
    black: ck.Color4f(0, 0, 0, 1),
    white: ck.Color4f(1, 1, 1, 1),
    red: ck.Color4f(1, 0, 0, 1),
    green: ck.Color4f(0, 0.502, 0, 1),
    blue: ck.Color4f(0, 0, 1, 1),
    gray: ck.Color4f(0.502, 0.502, 0.502, 1),
    grey: ck.Color4f(0.502, 0.502, 0.502, 1),
    yellow: ck.Color4f(1, 1, 0, 1),
    orange: ck.Color4f(1, 0.647, 0, 1),
    purple: ck.Color4f(0.502, 0, 0.502, 1),
    pink: ck.Color4f(1, 0.753, 0.796, 1),
    cyan: ck.Color4f(0, 1, 1, 1),
    magenta: ck.Color4f(1, 0, 1, 1),
  }
  return named[c.toLowerCase()] ?? ck.Color4f(0, 0, 0, 1)
}

function parseLength(value: number | string, reference: number): number {
  if (typeof value === 'number') return value
  if (value.endsWith('%')) return (parseFloat(value) / 100) * reference
  if (value.endsWith('px')) return parseFloat(value)
  return parseFloat(value)
}

interface ParsedShadow {
  inset: boolean
  offsetX: number
  offsetY: number
  blurRadius: number
  spreadDistance: number
  color: string
}

function parseBoxShadowString(str: string): ParsedShadow {
  const parts = str.trim().split(/\s+/)
  const inset = parts[0] === 'inset'
  const tokens = inset ? parts.slice(1) : parts
  const nums = tokens.filter((p) => /^-?[\d.]+px$/.test(p))
  const colorPart = tokens.filter((p) => !/^-?[\d.]+px$/.test(p)).join(' ')
  return {
    inset,
    offsetX: parseFloat(nums[0] ?? '0'),
    offsetY: parseFloat(nums[1] ?? '0'),
    blurRadius: parseFloat(nums[2] ?? '0'),
    spreadDistance: parseFloat(nums[3] ?? '0'),
    color: colorPart || 'black',
  }
}

// Fix #6: per-corner bezier rounded rect (arcToTangent not on ck.Path)
function buildRoundedRectPath(
  ck: CanvasKit,
  x: number,
  y: number,
  w: number,
  h: number,
  tl: number,
  tr: number,
  br: number,
  bl: number,
): InstanceType<CanvasKit['Path']> {
  const path = new ck.PathBuilder()
  const k = 0.5523 // cubic bezier approximation of quarter-circle
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

// Fix #5: use InstanceType<CanvasKit['Paint']> not ReturnType
function drawRoundedRect(
  canvas: Canvas,
  ck: CanvasKit,
  x: number,
  y: number,
  w: number,
  h: number,
  style: ViewStyle,
  paint: InstanceType<CanvasKit['Paint']>,
) {
  const ref = Math.min(w, h)
  const r = (v?: number | string) => (v !== undefined ? Math.min(parseLength(v, ref), ref / 2) : 0)

  const tl = r(style.borderTopLeftRadius ?? style.borderStartStartRadius ?? style.borderRadius)
  const tr = r(style.borderTopRightRadius ?? style.borderStartEndRadius ?? style.borderRadius)
  const br = r(style.borderBottomRightRadius ?? style.borderEndEndRadius ?? style.borderRadius)
  const bl = r(style.borderBottomLeftRadius ?? style.borderEndStartRadius ?? style.borderRadius)

  if (tl === tr && tr === br && br === bl) {
    // Fix #7: drawRRect not drawRoundRect
    canvas.drawRRect(ck.RRectXY(ck.XYWHRect(x, y, w, h), tl, tl), paint)
    return
  }

  const path = buildRoundedRectPath(ck, x, y, w, h, tl, tr, br, bl)
  canvas.drawPath(path, paint)
  path.delete()
}

function applyOverflowClip(
  canvas: Canvas,
  ck: CanvasKit,
  x: number,
  y: number,
  w: number,
  h: number,
  style: ViewStyle,
) {
  if (style.overflow !== 'hidden') return
  const ref = Math.min(w, h)
  const radius = style.borderRadius ? parseLength(style.borderRadius, ref) : 0
  canvas.clipRRect(ck.RRectXY(ck.XYWHRect(x, y, w, h), radius, radius), ck.ClipOp.Intersect, true)
}

function needsLayer(style: ViewStyle) {
  return (
    (style.opacity !== undefined && style.opacity < 1) ||
    (style.mixBlendMode !== undefined && style.mixBlendMode !== 'normal')
  )
}

function applyBorderStyle(
  ck: CanvasKit,
  paint: InstanceType<CanvasKit['Paint']>,
  borderStyle: string,
  strokeWidth: number,
) {
  if (borderStyle === 'dashed') {
    paint.setPathEffect(ck.PathEffect.MakeDash([strokeWidth * 3, strokeWidth * 2]))
  } else if (borderStyle === 'dotted') {
    paint.setPathEffect(ck.PathEffect.MakeDash([strokeWidth, strokeWidth]))
  }
}

// Fix #4: properly type-narrow boxShadow union before mapping
function normalizeShadows(style: ViewStyle): ParsedShadow[] {
  if (!style.boxShadow) return []

  if (typeof style.boxShadow === 'string') {
    return [parseBoxShadowString(style.boxShadow)]
  }

  if (Array.isArray(style.boxShadow)) {
    return style.boxShadow.map((entry) => {
      if (typeof entry === 'string') {
        return parseBoxShadowString(entry)
      }
      // Structured object form from BoxShadowValue
      return {
        inset: entry.inset ?? false,
        offsetX: parseLength(entry.offsetX as number | string, 0),
        offsetY: parseLength(entry.offsetY as number | string, 0),
        blurRadius: entry.blurRadius ? parseLength(entry.blurRadius as number | string, 0) : 0,
        spreadDistance: entry.spreadDistance
          ? parseLength(entry.spreadDistance as number | string, 0)
          : 0,
        color: (entry.color as string | undefined) ?? 'black',
      } satisfies ParsedShadow
    })
  }

  return []
}

/* ============================================================
 * 1. renderView
 * ============================================================ */
export function renderView(
  canvas: Canvas,
  ck: CanvasKit,
  layout: LayoutRect,
  style: ViewStyle,
): void {
  const { x, y, w, h } = layout

  const layered = needsLayer(style)
  if (layered) {
    const layerPaint = new ck.Paint()
    if (style.opacity !== undefined) layerPaint.setAlphaf(style.opacity)
    if (style.mixBlendMode && style.mixBlendMode !== 'normal') {
      const modeMap: Record<string, number> = {
        multiply: ck.BlendMode.Multiply.value,
        screen: ck.BlendMode.Screen.value,
        overlay: ck.BlendMode.Overlay.value,
        darken: ck.BlendMode.Darken.value,
        lighten: ck.BlendMode.Lighten.value,
        'color-dodge': ck.BlendMode.ColorDodge.value,
        'color-burn': ck.BlendMode.ColorBurn.value,
        'hard-light': ck.BlendMode.HardLight.value,
        'soft-light': ck.BlendMode.SoftLight.value,
        difference: ck.BlendMode.Difference.value,
        exclusion: ck.BlendMode.Exclusion.value,
        hue: ck.BlendMode.Hue.value,
        saturation: ck.BlendMode.Saturation.value,
        color: ck.BlendMode.Color.value,
        luminosity: ck.BlendMode.Luminosity.value,
      }
      const val = modeMap[style.mixBlendMode]
      if (val !== undefined) layerPaint.setBlendMode({ value: val } as never)
    }
    canvas.saveLayer(layerPaint)
    layerPaint.delete()
  } else {
    canvas.save()
  }

  // Outset box shadows — drawn before background so they sit behind
  const shadows = normalizeShadows(style)
  for (const sh of shadows.filter((s) => !s.inset)) {
    const p = new ck.Paint()
    p.setColor(parseColor(ck, sh.color as Color))
    p.setStyle(ck.PaintStyle.Fill)
    if (sh.blurRadius > 0) {
      p.setMaskFilter(ck.MaskFilter.MakeBlur(ck.BlurStyle.Normal, sh.blurRadius / 2, false))
    }
    drawRoundedRect(
      canvas,
      ck,
      x + sh.offsetX - sh.spreadDistance,
      y + sh.offsetY - sh.spreadDistance,
      w + sh.spreadDistance * 2,
      h + sh.spreadDistance * 2,
      style,
      p,
    )
    p.delete()
  }

  // Legacy iOS shadow
  if (style.shadowColor && !style.boxShadow) {
    const col = parseColor(ck, style.shadowColor)
    const p = new ck.Paint()
    p.setColor(ck.Color4f(col[0]!, col[1]!, col[2]!, (style.shadowOpacity ?? 1) * (col[3] ?? 1)))
    p.setStyle(ck.PaintStyle.Fill)
    if (style.shadowRadius && style.shadowRadius > 0) {
      p.setMaskFilter(ck.MaskFilter.MakeBlur(ck.BlurStyle.Normal, style.shadowRadius / 2, false))
    }
    drawRoundedRect(
      canvas,
      ck,
      x + (style.shadowOffset?.width ?? 0),
      y + (style.shadowOffset?.height ?? 0),
      w,
      h,
      style,
      p,
    )
    p.delete()
  }

  // Android elevation approximation
  if (style.elevation && style.elevation > 0 && !style.boxShadow && !style.shadowColor) {
    const p = new ck.Paint()
    p.setColor(ck.Color4f(0, 0, 0, 0.24))
    p.setStyle(ck.PaintStyle.Fill)
    p.setMaskFilter(ck.MaskFilter.MakeBlur(ck.BlurStyle.Normal, style.elevation * 0.5, false))
    drawRoundedRect(canvas, ck, x + 1, y + style.elevation * 0.5, w, h, style, p)
    p.delete()
  }

  applyOverflowClip(canvas, ck, x, y, w, h, style)

  // Background
  if (style.backgroundColor && style.backgroundColor !== 'transparent') {
    const p = new ck.Paint()
    p.setColor(parseColor(ck, style.backgroundColor))
    p.setStyle(ck.PaintStyle.Fill)
    p.setAntiAlias(true)
    drawRoundedRect(canvas, ck, x, y, w, h, style, p)
    p.delete()
  }

  // Inset shadows — after background, before border
  for (const sh of shadows.filter((s) => s.inset)) {
    canvas.save()
    applyOverflowClip(canvas, ck, x, y, w, h, { ...style, overflow: 'hidden' })
    const p = new ck.Paint()
    p.setColor(parseColor(ck, sh.color as Color))
    p.setStyle(ck.PaintStyle.Stroke)
    p.setStrokeWidth(sh.blurRadius * 2 + sh.spreadDistance * 2)
    if (sh.blurRadius > 0) {
      p.setMaskFilter(ck.MaskFilter.MakeBlur(ck.BlurStyle.Normal, sh.blurRadius / 2, false))
    }
    drawRoundedRect(canvas, ck, x + sh.offsetX, y + sh.offsetY, w, h, style, p)
    p.delete()
    canvas.restore()
  }

  // Borders
  const uniformW = style.borderWidth ?? 0
  const borderStyle = style.borderStyle ?? 'solid'

  const topW = style.borderTopWidth ?? uniformW
  const rightW = style.borderRightWidth ?? style.borderEndWidth ?? uniformW
  const bottomW = style.borderBottomWidth ?? uniformW
  const leftW = style.borderLeftWidth ?? style.borderStartWidth ?? uniformW

  const topC = style.borderTopColor ?? style.borderStartColor ?? style.borderColor
  const rightC = style.borderRightColor ?? style.borderEndColor ?? style.borderColor
  const bottomC = style.borderBottomColor ?? style.borderColor
  const leftC = style.borderLeftColor ?? style.borderStartColor ?? style.borderColor

  const isUniform =
    topW === rightW &&
    rightW === bottomW &&
    bottomW === leftW &&
    topW > 0 &&
    topC !== undefined &&
    topC === rightC &&
    rightC === bottomC &&
    bottomC === leftC

  if (isUniform) {
    const p = new ck.Paint()
    p.setColor(parseColor(ck, topC!))
    p.setStyle(ck.PaintStyle.Stroke)
    p.setStrokeWidth(topW)
    p.setAntiAlias(true)
    applyBorderStyle(ck, p, borderStyle, topW)
    const inset = topW / 2
    drawRoundedRect(canvas, ck, x + inset, y + inset, w - topW, h - topW, style, p)
    p.delete()
  } else {
    const drawSide = (
      x1: number,
      y1: number,
      x2: number,
      y2: number,
      bw: number,
      bc: Color | undefined,
    ) => {
      if (!bw || !bc) return
      const p = new ck.Paint()
      p.setColor(parseColor(ck, bc))
      p.setStyle(ck.PaintStyle.Stroke)
      p.setStrokeWidth(bw)
      p.setAntiAlias(true)
      applyBorderStyle(ck, p, borderStyle, bw)
      canvas.drawLine(x1, y1, x2, y2, p)
      p.delete()
    }
    drawSide(x, y + topW / 2, x + w, y + topW / 2, topW, topC)
    drawSide(x + w - rightW / 2, y, x + w - rightW / 2, y + h, rightW, rightC)
    drawSide(x, y + h - bottomW / 2, x + w, y + h - bottomW / 2, bottomW, bottomC)
    drawSide(x + leftW / 2, y, x + leftW / 2, y + h, leftW, leftC)
  }

  // Outline — drawn outside layout rect, does not affect layout
  if (style.outlineWidth && style.outlineColor) {
    const outW = parseLength(style.outlineWidth, w)
    const outOff = style.outlineOffset ? parseLength(style.outlineOffset, w) : 0
    const p = new ck.Paint()
    p.setColor(parseColor(ck, style.outlineColor))
    p.setStyle(ck.PaintStyle.Stroke)
    p.setStrokeWidth(outW)
    p.setAntiAlias(true)
    if (style.outlineStyle) applyBorderStyle(ck, p, style.outlineStyle, outW)
    const expand = outW / 2 + outOff
    drawRoundedRect(canvas, ck, x - expand, y - expand, w + expand * 2, h + expand * 2, style, p)
    p.delete()
  }

  canvas.restore()
}

/* ============================================================
 * 2. renderText
 * ============================================================ */
export function renderText(
  canvas: Canvas,
  ck: CanvasKit,
  fontMgr: FontMgr,
  layout: LayoutRect,
  style: TextStyle,
  text: string,
): void {
  const { x, y, w, h } = layout

  renderView(canvas, ck, layout, style)

  canvas.save()
  applyOverflowClip(canvas, ck, x, y, w, h, style)

  // textTransform
  let displayText = text
  if (style.textTransform === 'uppercase') displayText = text.toUpperCase()
  else if (style.textTransform === 'lowercase') displayText = text.toLowerCase()
  else if (style.textTransform === 'capitalize')
    displayText = text.replace(/\b\w/g, (c) => c.toUpperCase())

  // Fix #3: plain number values — no ReturnType<...> gymnastics
  const textAlignValue = (() => {
    switch (style.textAlign) {
      case 'left':
        return ck.TextAlign.Left.value
      case 'right':
        return ck.TextAlign.Right.value
      case 'center':
        return ck.TextAlign.Center.value
      case 'justify':
        return ck.TextAlign.Justify.value
      default:
        return ck.TextAlign.Start.value
    }
  })()

  const weightMap: Record<string, number> = {
    normal: 400,
    bold: 700,
    '100': 100,
    '200': 200,
    '300': 300,
    '400': 400,
    '500': 500,
    '600': 600,
    '700': 700,
    '800': 800,
    '900': 900,
  }

  // Fix #2: return plain 0, no bitwise-AND trick
  const getDecoration = (): number => {
    switch (style.textDecorationLine) {
      case 'underline':
        return ck.UnderlineDecoration
      case 'line-through':
        return ck.LineThroughDecoration
      case 'underline line-through':
        return ck.UnderlineDecoration | ck.LineThroughDecoration
      default:
        return 0
    }
  }

  // Fix #1: return EmbindEnumEntity directly, not number[]
  const getDecorationStyle = () => {
    switch (style.textDecorationStyle) {
      case 'double':
        return ck.DecorationStyle.Double
      case 'dotted':
        return ck.DecorationStyle.Dotted
      case 'dashed':
        return ck.DecorationStyle.Dashed
      default:
        return ck.DecorationStyle.Solid
    }
  }

  const fontSize = style.fontSize ?? 16
  const textColor = style.color ? parseColor(ck, style.color) : ck.Color4f(0, 0, 0, 1)
  const fontWeight =
    typeof style.fontWeight === 'number'
      ? style.fontWeight
      : (weightMap[style.fontWeight ?? 'normal'] ?? 400)

  const hasTextShadow =
    !!style.textShadowColor &&
    !!style.textShadowOffset &&
    (style.textShadowOffset.width !== 0 || style.textShadowOffset.height !== 0)

  const paraStyle = new ck.ParagraphStyle({
    textAlign: { value: textAlignValue } as never,
    textStyle: {
      color: textColor,
      fontFamilies: style.fontFamily ? [style.fontFamily] : ['Roboto'],
      fontSize,
      fontStyle: {
        weight: { value: fontWeight },
        slant: style.fontStyle === 'italic' ? ck.FontSlant.Italic : ck.FontSlant.Upright,
      },
      letterSpacing: style.letterSpacing,
      heightMultiplier: style.lineHeight
        ? typeof style.lineHeight === 'number'
          ? style.lineHeight / fontSize
          : parseFloat(style.lineHeight) / 100
        : undefined,
      decoration: getDecoration(),
      decorationStyle: getDecorationStyle(),
      decorationColor: style.textDecorationColor
        ? parseColor(ck, style.textDecorationColor)
        : textColor,
      shadows: hasTextShadow
        ? [
            {
              color: parseColor(ck, style.textShadowColor!),
              offset: [style.textShadowOffset!.width, style.textShadowOffset!.height] as [
                number,
                number,
              ],
              blurRadius: style.textShadowRadius ?? 0,
            },
          ]
        : undefined,
      fontFeatures: style.fontVariant?.map((v) => {
        const featureMap: Record<string, string> = {
          'small-caps': 'smcp',
          'oldstyle-nums': 'onum',
          'lining-nums': 'lnum',
          'tabular-nums': 'tnum',
          'proportional-nums': 'pnum',
        }
        return { name: featureMap[v] ?? v, value: 1 }
      }),
    },
    textDirection: style.writingDirection === 'rtl' ? ck.TextDirection.RTL : ck.TextDirection.LTR,
  })

  const builder = ck.ParagraphBuilder.Make(paraStyle, fontMgr)
  builder.addText(displayText)
  const para = builder.build()
  para.layout(w)

  // textAlignVertical (Android) — shift paragraph Y
  const textHeight = para.getHeight()
  let textY = y
  if (style.textAlignVertical === 'center') textY = y + (h - textHeight) / 2
  else if (style.textAlignVertical === 'bottom') textY = y + h - textHeight

  canvas.drawParagraph(para, x, textY)
  para.delete()
  builder.delete()

  canvas.restore()
}

/* ============================================================
 * 3. renderImage
 * ============================================================ */
export function renderImage(
  canvas: Canvas,
  ck: CanvasKit,
  layout: LayoutRect,
  style: ImageStyle,
  image: Image,
): void {
  const { x, y, w, h } = layout

  renderView(canvas, ck, layout, style)

  canvas.save()

  const radius = style.borderRadius ? parseLength(style.borderRadius, Math.min(w, h)) : 0
  canvas.clipRRect(ck.RRectXY(ck.XYWHRect(x, y, w, h), radius, radius), ck.ClipOp.Intersect, true)

  const imgW = image.width()
  const imgH = image.height()
  const mode = style.objectFit ?? style.resizeMode ?? 'cover'

  let dx = x,
    dy = y,
    dw = w,
    dh = h

  if (mode === 'stretch' || mode === 'fill') {
    // already set above
  } else if (mode === 'center') {
    dw = imgW
    dh = imgH
    dx = x + (w - imgW) / 2
    dy = y + (h - imgH) / 2
  } else if (mode !== 'repeat') {
    const scaleX = w / imgW
    const scaleY = h / imgH
    const scale =
      mode === 'cover'
        ? Math.max(scaleX, scaleY)
        : mode === 'scale-down'
          ? Math.min(Math.min(scaleX, scaleY), 1)
          : Math.min(scaleX, scaleY) // contain
    dw = imgW * scale
    dh = imgH * scale
    dx = x + (w - dw) / 2
    dy = y + (h - dh) / 2
  }

  const imagePaint = new ck.Paint()
  if (style.opacity !== undefined) imagePaint.setAlphaf(style.opacity)
  if (style.tintColor) {
    imagePaint.setColorFilter(
      ck.ColorFilter.MakeBlend(parseColor(ck, style.tintColor), ck.BlendMode.SrcIn),
    )
  }

  if (mode === 'repeat') {
    const shader = image.makeShaderOptions(
      ck.TileMode.Repeat,
      ck.TileMode.Repeat,
      ck.FilterMode.Linear,
      ck.MipmapMode.None,
    )
    const fillPaint = new ck.Paint()
    fillPaint.setShader(shader)
    canvas.drawRect(ck.XYWHRect(x, y, w, h), fillPaint)
    fillPaint.delete()
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

/* ============================================================
 * NodeRender
 *
 * Collects images decoded per-frame and destroys them together.
 * Paint/Paragraph objects are short-lived inside each render fn
 * and cleaned up immediately — no need to track them here.
 *
 * Usage:
 *   renderer.draw((canvas) => {
 *     const b = new NodeRender(canvas, ck, fontMgr)
 *     b.view(layout, viewStyle)
 *      .text(layout, textStyle, 'Hello')
 *      .image(layout, imageStyle, img)
 *     b.destroy()
 *   })
 * ============================================================ */
export class NodeRender {
  private images: Image[] = []

  constructor(
    private readonly canvas: Canvas,
    private readonly ck: CanvasKit,
    private readonly fontMgr: FontMgr,
  ) {}

  view(layout: LayoutRect, style: ViewStyle): this {
    renderView(this.canvas, this.ck, layout, style)
    return this
  }

  text(layout: LayoutRect, style: TextStyle, content: string): this {
    renderText(this.canvas, this.ck, this.fontMgr, layout, style, content)
    return this
  }

  image(layout: LayoutRect, style: ImageStyle, img: Image): this {
    renderImage(this.canvas, this.ck, layout, style, img)
    return this
  }

  /**
   * Decode raw image bytes and track the resulting Image for disposal.
   * Call once per image per session and cache the result — decoding is expensive.
   */
  decodeImage(data: ArrayBuffer): Image {
    const img = this.ck.MakeImageFromEncoded(data)
    if (!img) throw new Error('Failed to decode image — unsupported format or corrupt data')
    this.images.push(img)
    return img
  }

  /**
   * Release all decoded images. Call after surface.flush().
   * If you reuse images across frames, cache them outside the builder
   * and skip decodeImage — call image() directly with your cached Image.
   */
  destroy(): void {
    for (const img of this.images) {
      try {
        img.delete()
      } catch {
        /* already deleted */
      }
    }
    this.images = []
  }
}
