import type {
  Canvas,
  CanvasKit,
  ImageFilter,
  ColorFilter,
  InputRRect,
  BlendMode,
  Color,
} from 'canvaskit-wasm'
import type { ViewStyle, TransformFunction, FilterFunction, BoxShadowValue } from '@/core/styles'
import type { LayoutRect } from '../types'
import { DrawContext } from './draw-context'
import { toColor } from './color'
import { CONFIG } from '../../constants'
import {
  resolveRadii,
  isSharpRect,
  makeRRect,
  makeInsetRRect,
  makeOutsetRRect,
  type ResolvedRadii,
} from './path'

export interface ScrollPosition {
  x: number
  y: number
}

/**
 * Renders a View element on the CanvasKit canvas with all applicable visual styles.
 *
 * Draw order:
 * 1. Transforms (2D only)
 * 2. Opacity + filter layer (single saveLayer)
 * 3. Outset box shadows
 * 4. Background fill
 * 5. Borders (per-side color/width, solid/dashed/dotted)
 * 6. Inset box shadows
 * 7. Overflow clipping + scroll offset
 * 8. Child content (via drawContent callback)
 * 9. Outline (drawn outside the clip)
 *
 * @param ctx  Optional DrawContext for pooled WASM resources.
 *             When provided, Paint/MaskFilter/PathEffect objects are reused
 *             across frames instead of being allocated and deleted per call.
 */
export function renderView(
  ck: CanvasKit,
  canvas: Canvas,
  style: ViewStyle,
  rect: LayoutRect,
  scroll?: ScrollPosition,
  drawContent?: () => void,
  ctx?: DrawContext,
): void {
  // ── Early exit ────────────────────────────────────────────────────────────
  if (style.display === 'none') return

  const { x, y, w, h } = rect
  if (w <= 0 || h <= 0) return

  // ── DrawContext: use provided or create a disposable one ──────────────────
  const ownCtx = !ctx
  const dc = ctx ?? new DrawContext(ck)
  if (ownCtx) dc.beginFrame()

  // ── Resolve border radii ──────────────────────────────────────────────────
  const radii = resolveRadii(style, w, h)
  const rrect = makeRRect(ck, rect, radii)

  // ── canvas.save() — base state ────────────────────────────────────────────
  canvas.save()

  // ── 1. Transforms ────────────────────────────────────────────────────────
  if (style.transform && style.transform.length > 0) {
    applyTransforms(ck, canvas, style.transform, style.transformOrigin, rect)
  }

  // ── 2. Opacity + Filters + BlendMode (single saveLayer) ──────────────────
  const needsLayer = hasLayerEffects(style)

  if (needsLayer) {
    const layerPaint = dc.paint()

    // Opacity
    if (style.opacity !== undefined && style.opacity < 1) {
      layerPaint.setAlphaf(Math.max(0, Math.min(1, style.opacity)))
    }

    // Blend mode
    if (style.mixBlendMode) {
      const blendMode = resolveBlendMode(ck, style.mixBlendMode)
      if (blendMode) layerPaint.setBlendMode(blendMode)
    }

    // Image filters (blur)
    const imageFilter = buildImageFilter(ck, style.filter)
    if (imageFilter) {
      layerPaint.setImageFilter(imageFilter)
    }

    // Color filters (brightness, contrast, etc.)
    const colorFilter = buildColorFilter(ck, style.filter)
    if (colorFilter) {
      layerPaint.setColorFilter(colorFilter)
    }

    canvas.saveLayer(layerPaint)
  }

  // ── 3. Backface visibility ───────────────────────────────────────────────
  if (style.backfaceVisibility === 'hidden') {
    const ctm = canvas.getTotalMatrix()
    const det = ctm[0]! * ctm[4]! - ctm[1]! * ctm[3]!
    if (det < 0) {
      if (needsLayer) canvas.restore()
      canvas.restore()
      if (ownCtx) dc.dispose()
      return
    }
  }

  // ── 4. Outset box shadows ────────────────────────────────────────────────
  const shadows = style.boxShadow
  if (shadows) {
    const shadowArray = Array.isArray(shadows) ? shadows : [shadows]
    drawOutsetBoxShadows(ck, canvas, shadowArray, rect, radii, dc)
  }

  // ── 5. Background fill ──────────────────────────────────────────────────
  if (style.backgroundColor) {
    const bgPaint = dc.paint()
    bgPaint.setStyle(ck.PaintStyle.Fill)
    bgPaint.setColor(toColor(ck, style.backgroundColor))

    if (isSharpRect(radii)) {
      canvas.drawRect(Float32Array.from([x, y, x + w, y + h]), bgPaint)
    } else {
      canvas.drawRRect(rrect, bgPaint)
    }
  }

  // ── 6. Borders ──────────────────────────────────────────────────────────
  drawBorders(ck, canvas, style, rect, radii, rrect, dc)

  // ── 7. Inset box shadows ────────────────────────────────────────────────
  const insetShadows = style.boxShadow
  if (insetShadows) {
    const shadowArray = Array.isArray(insetShadows) ? insetShadows : [insetShadows]
    drawInsetBoxShadows(ck, canvas, shadowArray, rect, radii, rrect, dc)
  }

  // ── 8. Overflow clipping + scroll ────────────────────────────────────────
  if (style.overflow === 'hidden' || style.overflow === 'scroll') {
    if (isSharpRect(radii)) {
      canvas.clipRect(Float32Array.from([x, y, x + w, y + h]), ck.ClipOp.Intersect, true)
    } else {
      canvas.clipRRect(rrect, ck.ClipOp.Intersect, true)
    }
  }

  // Scroll offset
  // TODO: Add iOS-style auto-hide/show scroll indicators.
  //       Requires layout engine (yoga) to know content size vs viewport size.
  //       The indicator should be a thin rounded track+thumb drawn on top of
  //       clipped content, fading in on scroll start and fading out after idle.
  if (scroll && (scroll.x !== 0 || scroll.y !== 0)) {
    canvas.translate(-scroll.x, -scroll.y)
  }

  // ── Draw child content (image, text, etc.) ────────────────────────────────
  if (drawContent) {
    drawContent()
  }

  // ── Restore the filter/opacity layer ──────────────────────────────────────
  if (needsLayer) {
    canvas.restore()
  }

  // ── 9. Outline (drawn outside the clip) ──────────────────────────────────
  if (style.outlineWidth && style.outlineWidth > 0) {
    drawOutline(ck, canvas, style, rect, radii, dc)
  }

  // ── Restore base state ────────────────────────────────────────────────────
  canvas.restore()

  // ── Dispose temporary context if we created one ───────────────────────────
  if (ownCtx) dc.dispose()
}

// =============================================================================
// Transforms
// =============================================================================

function applyTransforms(
  ck: CanvasKit,
  canvas: Canvas,
  transforms: TransformFunction[],
  transformOrigin: string | (number | string)[] | undefined,
  rect: LayoutRect,
): void {
  // Resolve transform origin (default: center of the element)
  const { ox, oy } = resolveTransformOrigin(transformOrigin, rect)

  // Translate to origin
  canvas.translate(ox, oy)

  // Apply each transform in order
  for (const t of transforms) {
    if ('rotate' in t) {
      canvas.rotate(parseDeg(t.rotate), 0, 0)
    } else if ('rotateZ' in t) {
      canvas.rotate(parseDeg(t.rotateZ), 0, 0)
    } else if ('scale' in t) {
      canvas.scale(t.scale, t.scale)
    } else if ('scaleX' in t) {
      canvas.scale(t.scaleX, 1)
    } else if ('scaleY' in t) {
      canvas.scale(1, t.scaleY)
    } else if ('translateX' in t) {
      canvas.translate(t.translateX, 0)
    } else if ('translateY' in t) {
      canvas.translate(0, t.translateY)
    } else if ('skewX' in t) {
      const rad = parseRad(t.skewX)
      canvas.concat(Float32Array.from([1, Math.tan(rad), 0, 0, 1, 0, 0, 0, 1]))
    } else if ('skewY' in t) {
      const rad = parseRad(t.skewY)
      canvas.concat(Float32Array.from([1, 0, 0, Math.tan(rad), 1, 0, 0, 0, 1]))
    } else if ('matrix' in t) {
      // Support 6-element [a,b,c,d,e,f] CSS-style or 9-element 3x3 matrix
      const m = t.matrix
      if (m.length === 6) {
        canvas.concat(Float32Array.from([m[0], m[2], m[4], m[1], m[3], m[5], 0, 0, 1]))
      } else if (m.length >= 9) {
        canvas.concat(Float32Array.from(m.slice(0, 9)))
      }
    }
    // Skip 3D transforms: perspective, rotateX, rotateY (deferred)
  }

  // Translate back from origin
  canvas.translate(-ox, -oy)
}

function resolveTransformOrigin(
  origin: string | (number | string)[] | undefined,
  rect: LayoutRect,
): { ox: number; oy: number } {
  const cx = rect.x + rect.w / 2
  const cy = rect.y + rect.h / 2

  if (!origin) return { ox: cx, oy: cy }

  if (Array.isArray(origin)) {
    const ox = resolveOriginValue(origin[0], rect.w, rect.x)
    const oy = resolveOriginValue(origin[1], rect.h, rect.y)
    return { ox, oy }
  }

  if (typeof origin === 'string') {
    const parts = origin.trim().split(/\s+/)
    const ox = resolveOriginKeyword(parts[0] ?? 'center', rect.w, rect.x)
    const oy = resolveOriginKeyword(parts[1] ?? 'center', rect.h, rect.y)
    return { ox, oy }
  }

  return { ox: cx, oy: cy }
}

function resolveOriginValue(
  val: string | number | undefined,
  size: number,
  offset: number,
): number {
  if (val === undefined) return offset + size / 2
  if (typeof val === 'number') return offset + val
  if (val.endsWith('%')) return offset + (parseFloat(val) / 100) * size
  return offset + parseFloat(val)
}

function resolveOriginKeyword(val: string, size: number, offset: number): number {
  switch (val) {
    case 'left':
    case 'top':
      return offset
    case 'right':
    case 'bottom':
      return offset + size
    case 'center':
      return offset + size / 2
    default:
      if (val.endsWith('%')) return offset + (parseFloat(val) / 100) * size
      return offset + (parseFloat(val) || 0)
  }
}

function parseDeg(value: string | number): number {
  if (typeof value === 'number') return value
  if (value.endsWith('rad')) return parseFloat(value) * (180 / Math.PI)
  // Assume degrees (strip 'deg' if present)
  return parseFloat(value) || 0
}

function parseRad(value: string | number): number {
  if (typeof value === 'number') return value
  if (value.endsWith('rad')) return parseFloat(value)
  // Assume degrees
  const deg = parseFloat(value) || 0
  return deg * (Math.PI / 180)
}

// =============================================================================
// Layer effects (opacity, filters, blend mode)
// =============================================================================

function hasLayerEffects(style: ViewStyle): boolean {
  return (
    (style.opacity !== undefined && style.opacity < 1) ||
    !!style.mixBlendMode ||
    (!!style.filter && style.filter.length > 0)
  )
}

function resolveBlendMode(ck: CanvasKit, mode: string): BlendMode | null {
  const map: Record<string, () => BlendMode> = {
    normal: () => ck.BlendMode.SrcOver,
    multiply: () => ck.BlendMode.Multiply,
    screen: () => ck.BlendMode.Screen,
    overlay: () => ck.BlendMode.Overlay,
    darken: () => ck.BlendMode.Darken,
    lighten: () => ck.BlendMode.Lighten,
    'color-dodge': () => ck.BlendMode.ColorDodge,
    'color-burn': () => ck.BlendMode.ColorBurn,
    'hard-light': () => ck.BlendMode.HardLight,
    'soft-light': () => ck.BlendMode.SoftLight,
    difference: () => ck.BlendMode.Difference,
    exclusion: () => ck.BlendMode.Exclusion,
    hue: () => ck.BlendMode.Hue,
    saturation: () => ck.BlendMode.Saturation,
    color: () => ck.BlendMode.Color,
    luminosity: () => ck.BlendMode.Luminosity,
  }

  const factory = map[mode]
  return factory ? factory() : null
}

// =============================================================================
// Filters
// =============================================================================

/**
 * Builds a composed ImageFilter from the filter array (currently: blur, dropShadow).
 */
function buildImageFilter(
  ck: CanvasKit,
  filters: FilterFunction[] | undefined,
): ImageFilter | null {
  if (!filters || filters.length === 0) return null

  let result: ImageFilter | null = null

  for (const f of filters) {
    let current: ImageFilter | null = null

    if ('blur' in f) {
      const sigma = resolveFilterNumber(f.blur)
      if (sigma > 0) {
        current = ck.ImageFilter.MakeBlur(sigma, sigma, ck.TileMode.Clamp, null)
      }
    } else if ('dropShadow' in f) {
      const ds = f.dropShadow
      if (typeof ds === 'object' && ds !== null) {
        const sigma = (ds.standardDeviation ?? 0) / 2
        const color = ds.color ? ds.color : ck.Color(0, 0, 0, 0.75)
        current = ck.ImageFilter.MakeDropShadow(ds.offsetX, ds.offsetY, sigma, sigma, color, null)
      }
    }

    if (current) {
      result = result ? ck.ImageFilter.MakeCompose(current, result) : current
    }
  }

  return result
}

/**
 * Builds a composed ColorFilter from the filter array.
 * Handles: brightness, contrast, saturate, grayscale, sepia, invert, hueRotate, opacity.
 */
function buildColorFilter(
  ck: CanvasKit,
  filters: FilterFunction[] | undefined,
): ColorFilter | null {
  if (!filters || filters.length === 0) return null

  let result: ColorFilter | null = null

  for (const f of filters) {
    let matrix: number[] | null = null

    if ('brightness' in f) {
      const v = resolveFilterNumber(f.brightness)
      // prettier-ignore
      matrix = [
        v, 0, 0, 0, 0,
        0, v, 0, 0, 0,
        0, 0, v, 0, 0,
        0, 0, 0, 1, 0,
      ]
    } else if ('contrast' in f) {
      const v = resolveFilterNumber(f.contrast)
      const t = -(0.5 * v) + 0.5
      // prettier-ignore
      matrix = [
        v, 0, 0, 0, t,
        0, v, 0, 0, t,
        0, 0, v, 0, t,
        0, 0, 0, 1, 0,
      ]
    } else if ('saturate' in f) {
      const s = resolveFilterNumber(f.saturate)
      const lr = CONFIG.LUMINANCE_RED_WEIGHT
      const lg = CONFIG.LUMINANCE_GREEN_WEIGHT
      const lb = CONFIG.LUMINANCE_BLUE_WEIGHT
      const sr = (1 - s) * lr
      const sg = (1 - s) * lg
      const sb = (1 - s) * lb
      // prettier-ignore
      matrix = [
        sr + s, sg,     sb,     0, 0,
        sr,     sg + s, sb,     0, 0,
        sr,     sg,     sb + s, 0, 0,
        0,      0,      0,      1, 0,
      ]
    } else if ('grayscale' in f) {
      const v = resolveFilterNumber(f.grayscale)
      const s = 1 - v
      const lr = CONFIG.LUMINANCE_RED_WEIGHT
      const lg = CONFIG.LUMINANCE_GREEN_WEIGHT
      const lb = CONFIG.LUMINANCE_BLUE_WEIGHT
      const sr = (1 - s) * lr
      const sg = (1 - s) * lg
      const sb = (1 - s) * lb
      // prettier-ignore
      matrix = [
        sr + s, sg,     sb,     0, 0,
        sr,     sg + s, sb,     0, 0,
        sr,     sg,     sb + s, 0, 0,
        0,      0,      0,      1, 0,
      ]
    } else if ('sepia' in f) {
      const v = resolveFilterNumber(f.sepia)
      const iv = 1 - v
      // prettier-ignore
      matrix = [
        iv + v * 0.393, v * 0.769,      v * 0.189,      0, 0,
        v * 0.349,      iv + v * 0.686, v * 0.168,      0, 0,
        v * 0.272,      v * 0.534,      iv + v * 0.131, 0, 0,
        0,              0,              0,              1, 0,
      ]
    } else if ('invert' in f) {
      const v = resolveFilterNumber(f.invert)
      const iv = 1 - 2 * v
      // prettier-ignore
      matrix = [
        iv, 0,  0,  0, v,
        0,  iv, 0,  0, v,
        0,  0,  iv, 0, v,
        0,  0,  0,  1, 0,
      ]
    } else if ('hueRotate' in f) {
      const deg = parseFloat(f.hueRotate) || 0
      const rad = deg * (Math.PI / 180)
      const cos = Math.cos(rad)
      const sin = Math.sin(rad)
      const lr = CONFIG.LUMINANCE_HUE_RED_WEIGHT
      const lg = CONFIG.LUMINANCE_HUE_GREEN_WEIGHT
      const lb = CONFIG.LUMINANCE_HUE_BLUE_WEIGHT
      // prettier-ignore
      matrix = [
        lr + cos * (1 - lr) + sin * (-lr),
        lg + cos * (-lg) + sin * (-lg),
        lb + cos * (-lb) + sin * (1 - lb),
        0, 0,
        lr + cos * (-lr) + sin * 0.143,
        lg + cos * (1 - lg) + sin * 0.140,
        lb + cos * (-lb) + sin * (-0.283),
        0, 0,
        lr + cos * (-lr) + sin * (-(1 - lr)),
        lg + cos * (-lg) + sin * lg,
        lb + cos * (1 - lb) + sin * lb,
        0, 0,
        0, 0, 0, 1, 0,
      ]
    } else if ('opacity' in f) {
      const v = resolveFilterNumber(f.opacity)
      // prettier-ignore
      matrix = [
        1, 0, 0, 0, 0,
        0, 1, 0, 0, 0,
        0, 0, 1, 0, 0,
        0, 0, 0, v, 0,
      ]
    }

    if (matrix) {
      const cf = ck.ColorFilter.MakeMatrix(Float32Array.from(matrix))
      result = result ? ck.ColorFilter.MakeCompose(cf, result) : cf
    }
  }

  return result
}

function resolveFilterNumber(value: number | string): number {
  if (typeof value === 'number') return value
  return parseFloat(value) || 0
}

// =============================================================================
// Box Shadows
// =============================================================================

function drawOutsetBoxShadows(
  ck: CanvasKit,
  canvas: Canvas,
  shadows: BoxShadowValue[],
  rect: LayoutRect,
  radii: ResolvedRadii,
  dc: DrawContext,
): void {
  for (const shadow of shadows) {
    if (shadow.inset) continue

    const spread = resolveDimension(shadow.spreadDistance ?? 0, rect.w)
    const blurRadius = resolveDimension(shadow.blurRadius ?? 0, rect.w)
    const sigma = blurRadius / 2
    const color = shadow.color ? shadow.color : CONFIG.BOX_SHADOW_DEFAULT_COLOR

    const shadowRect: LayoutRect = {
      x: rect.x + resolveDimension(shadow.offsetX, rect.w) - spread,
      y: rect.y + resolveDimension(shadow.offsetY, rect.h) - spread,
      w: rect.w + spread * 2,
      h: rect.h + spread * 2,
    }

    const spreadRadii: ResolvedRadii = {
      tlx: Math.max(0, radii.tlx + spread),
      tly: Math.max(0, radii.tly + spread),
      trx: Math.max(0, radii.trx + spread),
      try_: Math.max(0, radii.try_ + spread),
      brx: Math.max(0, radii.brx + spread),
      bry: Math.max(0, radii.bry + spread),
      blx: Math.max(0, radii.blx + spread),
      bly: Math.max(0, radii.bly + spread),
    }

    const shadowRRect = makeRRect(ck, shadowRect, spreadRadii)

    const paint = dc.paint()
    paint.setColor(color)
    paint.setStyle(ck.PaintStyle.Fill)

    if (sigma > 0) {
      paint.setMaskFilter(dc.blurMask(sigma))
    }

    canvas.drawRRect(shadowRRect, paint)
  }
}

function drawInsetBoxShadows(
  ck: CanvasKit,
  canvas: Canvas,
  shadows: BoxShadowValue[],
  rect: LayoutRect,
  radii: ResolvedRadii,
  clipRRect: InputRRect,
  dc: DrawContext,
): void {
  const insetShadows = shadows.filter((s) => s.inset)
  if (insetShadows.length === 0) return

  canvas.save()
  canvas.clipRRect(clipRRect, ck.ClipOp.Intersect, true)

  for (const shadow of insetShadows) {
    const spread = resolveDimension(shadow.spreadDistance ?? 0, rect.w)
    const blurRadius = resolveDimension(shadow.blurRadius ?? 0, rect.w)
    const sigma = blurRadius / 2
    const color = shadow.color ? shadow.color : CONFIG.BOX_SHADOW_DEFAULT_COLOR

    const offsetX = resolveDimension(shadow.offsetX, rect.w)
    const offsetY = resolveDimension(shadow.offsetY, rect.h)

    const holeRect: LayoutRect = {
      x: rect.x + offsetX + spread,
      y: rect.y + offsetY + spread,
      w: Math.max(0, rect.w - spread * 2),
      h: Math.max(0, rect.h - spread * 2),
    }

    const holeRadii: ResolvedRadii = {
      tlx: Math.max(0, radii.tlx - spread),
      tly: Math.max(0, radii.tly - spread),
      trx: Math.max(0, radii.trx - spread),
      try_: Math.max(0, radii.try_ - spread),
      brx: Math.max(0, radii.brx - spread),
      bry: Math.max(0, radii.bry - spread),
      blx: Math.max(0, radii.blx - spread),
      bly: Math.max(0, radii.bly - spread),
    }

    const holeRRect = makeRRect(ck, holeRect, holeRadii)

    const expand = blurRadius * 2 + Math.abs(offsetX) + Math.abs(offsetY) + 100
    const outerPB = new ck.PathBuilder()
    outerPB.addRect(
      Float32Array.from([
        rect.x - expand,
        rect.y - expand,
        rect.x + rect.w + expand,
        rect.y + rect.h + expand,
      ]),
    )
    outerPB.addRRect(holeRRect)
    outerPB.setFillType(ck.FillType.EvenOdd)
    const outerPath = outerPB.snapshot()
    outerPB.delete()

    const paint = dc.paint()
    paint.setColor(color)
    paint.setStyle(ck.PaintStyle.Fill)

    if (sigma > 0) {
      paint.setMaskFilter(dc.blurMask(sigma))
    }

    canvas.drawPath(outerPath, paint)
    outerPath.delete()
  }

  canvas.restore()
}

// =============================================================================
// Borders
// =============================================================================

function drawBorders(
  ck: CanvasKit,
  canvas: Canvas,
  style: ViewStyle,
  rect: LayoutRect,
  radii: ResolvedRadii,
  _rrect: InputRRect,
  dc: DrawContext,
): void {
  const bw = toNum(style.borderWidth)
  const btw = toNum(style.borderTopWidth) ?? bw ?? 0
  const brw = toNum(style.borderRightWidth) ?? bw ?? 0
  const bbw = toNum(style.borderBottomWidth) ?? bw ?? 0
  const blw = toNum(style.borderLeftWidth) ?? bw ?? 0

  if (btw === 0 && brw === 0 && bbw === 0 && blw === 0) return

  const isRTL = style.direction === 'rtl'
  const baseColor = style.borderColor

  // Resolve logical mappings
  const tc =
    style.borderTopColor ?? style.borderBlockStartColor ?? style.borderBlockColor ?? baseColor
  const bc =
    style.borderBottomColor ?? style.borderBlockEndColor ?? style.borderBlockColor ?? baseColor

  const startColor =
    style.borderStartColor ?? style.borderInlineStartColor ?? style.borderInlineColor
  const endColor = style.borderEndColor ?? style.borderInlineEndColor ?? style.borderInlineColor

  const lc =
    style.borderLeftColor ?? (isRTL ? endColor : startColor) ?? style.borderInlineColor ?? baseColor
  const rc =
    style.borderRightColor ??
    (isRTL ? startColor : endColor) ??
    style.borderInlineColor ??
    baseColor

  if (!tc && !rc && !bc && !lc) return

  const borderStyle = style.borderStyle ?? 'solid'

  const isUniformWidth = btw === brw && brw === bbw && bbw === blw
  const isUniformColor = tc === rc && rc === bc && bc === lc

  if (isUniformWidth && isUniformColor && btw > 0 && tc) {
    drawUniformBorder(ck, canvas, tc, btw, borderStyle, rect, radii, dc)
  } else {
    drawPerSideBorders(
      ck,
      canvas,
      rect,
      radii,
      { top: btw, right: brw, bottom: bbw, left: blw },
      { top: tc, right: rc, bottom: bc, left: lc },
      borderStyle,
      dc,
    )
  }
}

function drawUniformBorder(
  ck: CanvasKit,
  canvas: Canvas,
  color: Color,
  width: number,
  borderStyle: 'solid' | 'dotted' | 'dashed',
  rect: LayoutRect,
  radii: ResolvedRadii,
  dc: DrawContext,
): void {
  const paint = dc.paint()
  paint.setStyle(ck.PaintStyle.Stroke)
  paint.setStrokeWidth(width)
  paint.setColor(toColor(ck, color))

  const effect = dc.borderEffect(borderStyle, width)
  if (effect) {
    paint.setPathEffect(effect)
  }

  const halfW = width / 2
  const strokeRect: LayoutRect = {
    x: rect.x + halfW,
    y: rect.y + halfW,
    w: Math.max(0, rect.w - width),
    h: Math.max(0, rect.h - width),
  }

  const strokeRadii: ResolvedRadii = {
    tlx: Math.max(0, radii.tlx - halfW),
    tly: Math.max(0, radii.tly - halfW),
    trx: Math.max(0, radii.trx - halfW),
    try_: Math.max(0, radii.try_ - halfW),
    brx: Math.max(0, radii.brx - halfW),
    bry: Math.max(0, radii.bry - halfW),
    blx: Math.max(0, radii.blx - halfW),
    bly: Math.max(0, radii.bly - halfW),
  }

  const strokeRRect = makeRRect(ck, strokeRect, strokeRadii)
  canvas.drawRRect(strokeRRect, paint)
}

interface SideWidths {
  top: number
  right: number
  bottom: number
  left: number
}

interface SideColors {
  top: Color | undefined
  right: Color | undefined
  bottom: Color | undefined
  left: Color | undefined
}

function drawPerSideBorders(
  ck: CanvasKit,
  canvas: Canvas,
  rect: LayoutRect,
  radii: ResolvedRadii,
  widths: SideWidths,
  colors: SideColors,
  borderStyle: 'solid' | 'dotted' | 'dashed',
  dc: DrawContext,
): void {
  const { x, y, w, h } = rect

  const hasRadius = !(
    radii.tlx === 0 &&
    radii.tly === 0 &&
    radii.trx === 0 &&
    radii.try_ === 0 &&
    radii.brx === 0 &&
    radii.bry === 0 &&
    radii.blx === 0 &&
    radii.bly === 0
  )

  if (hasRadius) {
    const outerRRect = makeRRect(ck, rect, radii)
    const innerRRect = makeInsetRRect(
      ck,
      rect,
      radii,
      widths.top,
      widths.right,
      widths.bottom,
      widths.left,
    )

    // Top side
    if (widths.top > 0 && colors.top) {
      canvas.save()
      const clipPB = new ck.PathBuilder()
      clipPB.moveTo(x, y)
      clipPB.lineTo(x + w, y)
      clipPB.lineTo(x + w - widths.right, y + widths.top)
      clipPB.lineTo(x + widths.left, y + widths.top)
      const clipPath = clipPB.snapshot()
      clipPB.delete()
      canvas.clipPath(clipPath, ck.ClipOp.Intersect, true)

      const paint = dc.paint()
      paint.setStyle(ck.PaintStyle.Fill)
      paint.setColor(toColor(ck, colors.top))
      canvas.drawDRRect(outerRRect, innerRRect, paint)
      clipPath.delete()
      canvas.restore()
    }

    // Right side
    if (widths.right > 0 && colors.right) {
      canvas.save()
      const clipPB = new ck.PathBuilder()
      clipPB.moveTo(x + w, y)
      clipPB.lineTo(x + w, y + h)
      clipPB.lineTo(x + w - widths.right, y + h - widths.bottom)
      clipPB.lineTo(x + w - widths.right, y + widths.top)
      const clipPath = clipPB.snapshot()
      clipPB.delete()
      canvas.clipPath(clipPath, ck.ClipOp.Intersect, true)

      const paint = dc.paint()
      paint.setStyle(ck.PaintStyle.Fill)
      paint.setColor(toColor(ck, colors.right))
      canvas.drawDRRect(outerRRect, innerRRect, paint)
      clipPath.delete()
      canvas.restore()
    }

    // Bottom side
    if (widths.bottom > 0 && colors.bottom) {
      canvas.save()
      const clipPB = new ck.PathBuilder()
      clipPB.moveTo(x, y + h)
      clipPB.lineTo(x + w, y + h)
      clipPB.lineTo(x + w - widths.right, y + h - widths.bottom)
      clipPB.lineTo(x + widths.left, y + h - widths.bottom)
      const clipPath = clipPB.snapshot()
      clipPB.delete()
      canvas.clipPath(clipPath, ck.ClipOp.Intersect, true)

      const paint = dc.paint()
      paint.setStyle(ck.PaintStyle.Fill)
      paint.setColor(toColor(ck, colors.bottom))
      canvas.drawDRRect(outerRRect, innerRRect, paint)
      clipPath.delete()
      canvas.restore()
    }

    // Left side
    if (widths.left > 0 && colors.left) {
      canvas.save()
      const clipPB = new ck.PathBuilder()
      clipPB.moveTo(x, y)
      clipPB.lineTo(x + widths.left, y + widths.top)
      clipPB.lineTo(x + widths.left, y + h - widths.bottom)
      clipPB.lineTo(x, y + h)
      const clipPath = clipPB.snapshot()
      clipPB.delete()
      canvas.clipPath(clipPath, ck.ClipOp.Intersect, true)

      const paint = dc.paint()
      paint.setStyle(ck.PaintStyle.Fill)
      paint.setColor(toColor(ck, colors.left))
      canvas.drawDRRect(outerRRect, innerRRect, paint)
      clipPath.delete()
      canvas.restore()
    }
  } else {
    // No border radius — simple rect lines per side
    const sides: Array<{
      sx: number
      sy: number
      ex: number
      ey: number
      width: number
      color: Color | undefined
    }> = [
      {
        sx: x,
        sy: y + widths.top / 2,
        ex: x + w,
        ey: y + widths.top / 2,
        width: widths.top,
        color: colors.top,
      },
      {
        sx: x + w - widths.right / 2,
        sy: y,
        ex: x + w - widths.right / 2,
        ey: y + h,
        width: widths.right,
        color: colors.right,
      },
      {
        sx: x,
        sy: y + h - widths.bottom / 2,
        ex: x + w,
        ey: y + h - widths.bottom / 2,
        width: widths.bottom,
        color: colors.bottom,
      },
      {
        sx: x + widths.left / 2,
        sy: y,
        ex: x + widths.left / 2,
        ey: y + h,
        width: widths.left,
        color: colors.left,
      },
    ]

    for (const side of sides) {
      if (side.width <= 0 || !side.color) continue

      const paint = dc.paint()
      paint.setStyle(ck.PaintStyle.Stroke)
      paint.setStrokeWidth(side.width)
      paint.setColor(toColor(ck, side.color))

      const effect = dc.borderEffect(borderStyle, side.width)
      if (effect) {
        paint.setPathEffect(effect)
      }

      canvas.drawLine(side.sx, side.sy, side.ex, side.ey, paint)
    }
  }
}

// =============================================================================
// Outline
// =============================================================================

function drawOutline(
  ck: CanvasKit,
  canvas: Canvas,
  style: ViewStyle,
  rect: LayoutRect,
  radii: ResolvedRadii,
  dc: DrawContext,
): void {
  const outlineWidth = style.outlineWidth ?? 0
  if (outlineWidth <= 0) return

  const outlineOffset = style.outlineOffset ?? 0
  const outlineColor = style.outlineColor ?? ck.Color(0, 0, 0, 1)
  const outlineStyle = style.outlineStyle ?? 'solid'

  const totalOffset = outlineOffset + outlineWidth / 2
  const outlineRRect = makeOutsetRRect(ck, rect, radii, totalOffset)

  const paint = dc.paint()
  paint.setStyle(ck.PaintStyle.Stroke)
  paint.setStrokeWidth(outlineWidth)
  paint.setColor(outlineColor)

  const effect = dc.borderEffect(outlineStyle, outlineWidth)
  if (effect) {
    paint.setPathEffect(effect)
  }

  canvas.drawRRect(outlineRRect, paint)
}

// =============================================================================
// Helpers
// =============================================================================

function toNum(value: number | string | undefined | null): number | undefined {
  if (value === undefined || value === null) return undefined
  if (typeof value === 'number') return value
  const n = parseFloat(value)
  return Number.isNaN(n) ? undefined : n
}
function resolveDimension(value: number | string | undefined, size: number): number {
  if (value === undefined) return 0
  if (typeof value === 'number') return value
  if (value.endsWith('%')) {
    return (parseFloat(value) / 100) * size
  }
  return parseFloat(value) || 0
}
