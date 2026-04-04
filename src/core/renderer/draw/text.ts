import type { Canvas, CanvasKit, Paragraph } from 'canvaskit-wasm'
import type { TextStyle as KraflowTextStyle } from '@/core/styles'
import type { FontSystem, ParagraphOptions } from '@/core/fonts'
import type { LayoutRect } from '../types'
import { toColor } from './color'
import { resolveRadii, isSharpRect, makeRRect } from './path'
import { renderView } from './view'

/**
 * Renders a Text element on the CanvasKit canvas with all applicable visual styles.
 *
 * The text renderer:
 * 1. Delegates all ViewStyle rendering (background, borders, shadows, transforms,
 *    opacity, filters, overflow clipping) to renderView via the drawContent callback
 * 2. Builds a CanvasKit Paragraph via the FontSystem
 * 3. Draws the paragraph with:
 *    - Text color, font family/size/weight/style
 *    - Letter spacing, line height
 *    - Text alignment (left/right/center/justify)
 *    - Text decoration (underline, line-through)
 *    - Text shadow
 *    - Text transform (uppercase, lowercase, capitalize)
 *    - Vertical alignment within the rect
 *    - Border-radius clipping
 *
 * Note: scroll is NOT supported on Text — only View can have scroll position.
 */
export function renderText(
  ck: CanvasKit,
  canvas: Canvas,
  style: KraflowTextStyle,
  rect: LayoutRect,
  text: string,
  fontSystem?: FontSystem | null,
  paragraph?: Paragraph | null,
): void {
  if (style.display === 'none') return

  const { x, y, w, h } = rect
  if (w <= 0 || h <= 0) return

  // If no text content, just render the view (background, borders, etc.)
  if (!text || text.length === 0) {
    renderView(ck, canvas, style, rect)
    return
  }

  // Render the view with text drawing as the content callback.
  // Transforms, opacity, filters, overflow clipping are all handled by renderView.
  renderView(ck, canvas, style, rect, undefined, () => {
    canvas.save()

    // ── Clip to border radii for text content ──────────────────────────────
    const radii = resolveRadii(style, w, h)
    if (!isSharpRect(radii)) {
      const rrect = makeRRect(ck, rect, radii)
      canvas.clipRRect(rrect, ck.ClipOp.Intersect, true)
    }

    // ── Use provided paragraph or build one inline ────────────────────────
    let para = paragraph ?? null
    let paraOwned = false

    if (!para && fontSystem) {
      const opts = buildParagraphOptions(ck, style)
      para = fontSystem.makeParagraphSync(text, style.fontFamily ?? 'system-ui', opts, w)
      paraOwned = true
    }

    if (para) {
      // ── Resolve vertical alignment ──────────────────────────────────────
      const paraHeight = para.getHeight()
      const textY = resolveVerticalAlign(style, y, h, paraHeight)

      canvas.drawParagraph(para, x, textY)

      if (paraOwned) {
        para.delete()
      }
    }

    canvas.restore()
  })
}

/**
 * Async version: loads fonts if needed, then renders text.
 * Call this when fonts might not be loaded yet.
 */
export async function renderTextAsync(
  ck: CanvasKit,
  canvas: Canvas,
  style: KraflowTextStyle,
  rect: LayoutRect,
  text: string,
  fontSystem: FontSystem,
): Promise<void> {
  if (style.display === 'none') return
  if (!text || text.length === 0) return

  const opts = buildParagraphOptions(ck, style)
  const para = await fontSystem.makeParagraph(text, style.fontFamily ?? 'system-ui', opts, rect.w)

  renderText(ck, canvas, style, rect, text, fontSystem, para)
  para.delete()
}

// =============================================================================
// Paragraph options builder
// =============================================================================

function buildParagraphOptions(ck: CanvasKit, style: KraflowTextStyle): ParagraphOptions {
  const opts: ParagraphOptions = {
    fontSize: style.fontSize ?? 14,

    // Color
    color: style.color ? toColorF32(ck, style.color) : new Float32Array([0, 0, 0, 1]),

    // Font
    fontFamilies: style.fontFamily ? [style.fontFamily] : undefined,
    fontWeight: resolveFontWeight(style.fontWeight),
    italic: style.fontStyle === 'italic',

    // Spacing
    letterSpacing: style.letterSpacing,
    lineHeight: style.lineHeight,
    heightMultiplier: style.lineHeight ? style.lineHeight / (style.fontSize ?? 14) : undefined,

    // Alignment
    textAlignValue: resolveTextAlign(ck, style.textAlign),
    textDirectionRTL: style.writingDirection === 'rtl',
    textAlignVertical: resolveTextAlignVertical(style),

    // Transform
    textTransform: style.textTransform ?? 'none',

    // Decoration
    decoration: resolveDecoration(ck, style.textDecorationLine),
    decorationStyle: resolveDecorationStyle(ck, style.textDecorationStyle),
    decorationColor: style.textDecorationColor
      ? toColorF32(ck, style.textDecorationColor)
      : undefined,

    // Shadow
    textShadow: resolveTextShadow(ck, style),

    // Font features from fontVariant
    fontFeatures: resolveFontFeatures(style.fontVariant),
  }

  return opts
}

// =============================================================================
// Font weight resolution
// =============================================================================

function resolveFontWeight(weight: KraflowTextStyle['fontWeight']): number {
  if (weight === undefined || weight === null) return 400
  if (typeof weight === 'number') return weight
  switch (weight) {
    case 'normal':
      return 400
    case 'bold':
      return 700
    default:
      return parseInt(weight, 10) || 400
  }
}

// =============================================================================
// Text alignment
// =============================================================================

function resolveTextAlign(ck: CanvasKit, align: KraflowTextStyle['textAlign']): number | undefined {
  if (!align || align === 'auto') return undefined
  switch (align) {
    case 'left':
      return ck.TextAlign.Left.value
    case 'right':
      return ck.TextAlign.Right.value
    case 'center':
      return ck.TextAlign.Center.value
    case 'justify':
      return ck.TextAlign.Justify.value
    default:
      return undefined
  }
}

function resolveTextAlignVertical(
  style: KraflowTextStyle,
): 'top' | 'center' | 'bottom' | undefined {
  // verticalAlign and textAlignVertical
  const v = style.textAlignVertical ?? style.verticalAlign
  if (!v || v === 'auto') return undefined
  if (v === 'middle') return 'center'
  return v as 'top' | 'center' | 'bottom'
}

function resolveVerticalAlign(
  style: KraflowTextStyle,
  y: number,
  h: number,
  paraHeight: number,
): number {
  const align = resolveTextAlignVertical(style)

  switch (align) {
    case 'center':
      return y + (h - paraHeight) / 2
    case 'bottom':
      return y + h - paraHeight
    case 'top':
    default:
      return y
  }
}

// =============================================================================
// Text decoration
// =============================================================================

function resolveDecoration(
  ck: CanvasKit,
  decoration: KraflowTextStyle['textDecorationLine'],
): number | undefined {
  if (!decoration || decoration === 'none') return undefined
  let flags = 0
  if (decoration.includes('underline')) {
    flags |= ck.UnderlineDecoration
  }
  if (decoration.includes('line-through')) {
    flags |= ck.LineThroughDecoration
  }
  return flags || undefined
}

function resolveDecorationStyle(
  ck: CanvasKit,
  decorStyle: KraflowTextStyle['textDecorationStyle'],
) {
  if (!decorStyle) return undefined
  switch (decorStyle) {
    case 'solid':
      return ck.DecorationStyle.Solid
    case 'double':
      return ck.DecorationStyle.Double
    case 'dotted':
      return ck.DecorationStyle.Dotted
    case 'dashed':
      return ck.DecorationStyle.Dashed
    default:
      return undefined
  }
}

// =============================================================================
// Text shadow
// =============================================================================

function resolveTextShadow(ck: CanvasKit, style: KraflowTextStyle): ParagraphOptions['textShadow'] {
  if (!style.textShadowColor && !style.textShadowOffset && !style.textShadowRadius) {
    return null
  }

  return {
    color: style.textShadowColor
      ? toColorF32(ck, style.textShadowColor)
      : new Float32Array([0, 0, 0, 0.5]),
    offsetX: style.textShadowOffset?.width ?? 0,
    offsetY: style.textShadowOffset?.height ?? 0,
    blurRadius: style.textShadowRadius ?? 0,
  }
}

// =============================================================================
// Font variant → font features
// =============================================================================

function resolveFontFeatures(
  variant: KraflowTextStyle['fontVariant'],
): { name: string; value: number }[] | undefined {
  if (!variant) return undefined

  const features: { name: string; value: number }[] = []
  const variants = Array.isArray(variant) ? variant : variant.split(/\s+/)

  for (const v of variants) {
    switch (v) {
      case 'small-caps':
        features.push({ name: 'smcp', value: 1 })
        break
      case 'oldstyle-nums':
        features.push({ name: 'onum', value: 1 })
        break
      case 'lining-nums':
        features.push({ name: 'lnum', value: 1 })
        break
      case 'tabular-nums':
        features.push({ name: 'tnum', value: 1 })
        break
      case 'proportional-nums':
        features.push({ name: 'pnum', value: 1 })
        break
    }
  }

  return features.length > 0 ? features : undefined
}

// =============================================================================
// Color helper
// =============================================================================

function toColorF32(ck: CanvasKit, value: import('@/core/styles').ColorValue): Float32Array {
  const c = toColor(ck, value)
  return c instanceof Float32Array ? c : Float32Array.from(c as unknown as number[])
}
