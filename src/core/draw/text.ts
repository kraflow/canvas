import type { Canvas, CanvasKit } from 'canvaskit-wasm'
import type { TextStyle } from '@/core/styles'
import type { FontSystem } from '@/core/fonts'
import type { Rect } from './types'
import type { TextContext } from './context'

export function text(
  ck: CanvasKit,
  canvas: Canvas,
  ctx: TextContext,
  fontSystem: FontSystem,
  style: TextStyle,
  content: string,
  rect: Rect,
) {
  // If content or style boundary changes drastically, we rebuild paragraph.
  // Weak comparisons on content for now. A deep style equality check could be
  // added here to fully prevent rebuilds, but `fontSystem.makeParagraph` is incredibly fast
  // if the font is loaded, though it does remake C++ structural allocations.
  // For strict 60FPS animation of purely layout styles, we'd need more complex tracking.

  if (ctx.cachedContent !== content) {
    if (ctx.paragraph) {
      ctx.paragraph.delete() // clean up old allocations
    }

    ctx.cachedContent = content
    ctx.paragraph = null
    ctx.isBuilding = true

    let textAlignValue = ck.TextAlign.Left.value
    if (style.textAlign === 'center') textAlignValue = ck.TextAlign.Center.value
    else if (style.textAlign === 'right') textAlignValue = ck.TextAlign.Right.value
    else if (style.textAlign === 'justify') textAlignValue = ck.TextAlign.Justify.value

    let decoration = ck.NoDecoration
    if (style.textDecorationLine) {
      if (style.textDecorationLine.includes('underline')) decoration |= ck.UnderlineDecoration
      if (style.textDecorationLine.includes('line-through')) decoration |= ck.LineThroughDecoration
    }

    let decorationStyle = ck.DecorationStyle.Solid
    if (style.textDecorationStyle === 'double') decorationStyle = ck.DecorationStyle.Double
    else if (style.textDecorationStyle === 'dotted') decorationStyle = ck.DecorationStyle.Dotted
    else if (style.textDecorationStyle === 'dashed') decorationStyle = ck.DecorationStyle.Dashed

    let textShadow = null
    if (style.textShadowColor) {
      const parsedColor = ck.parseColorString(style.textShadowColor)
      if (parsedColor) {
        textShadow = {
          color: parsedColor,
          offsetX: style.textShadowOffset?.width || 0,
          offsetY: style.textShadowOffset?.height || 0,
          blurRadius: style.textShadowRadius || 0,
        }
      }
    }

    let fontFeatures: { name: string; value: number }[] | undefined = undefined
    if (style.fontVariant && style.fontVariant.length > 0) {
      fontFeatures = []
      for (const variant of style.fontVariant) {
        if (variant === 'small-caps') fontFeatures.push({ name: 'smcp', value: 1 })
        else if (variant === 'oldstyle-nums') fontFeatures.push({ name: 'onum', value: 1 })
        else if (variant === 'lining-nums') fontFeatures.push({ name: 'lnum', value: 1 })
        else if (variant === 'tabular-nums') fontFeatures.push({ name: 'tnum', value: 1 })
        else if (variant === 'proportional-nums') fontFeatures.push({ name: 'pnum', value: 1 })
      }
    }

    fontSystem
      .makeParagraph(
        content,
        style.fontFamily || 'Inter',
        {
          fontSize: style.fontSize,
          color: style.color ? ck.parseColorString(style.color) || undefined : undefined,
          fontWeight: style.fontWeight === 'bold' ? 700 : Number(style.fontWeight) || 400,
          letterSpacing: style.letterSpacing,
          lineHeight: style.lineHeight,
          italic: style.fontStyle === 'italic',
          textAlignValue,
          textDirectionRTL: style.writingDirection === 'rtl',
          textAlignVertical: (style.textAlignVertical as 'top' | 'center' | 'bottom') || 'top',
          textTransform: style.textTransform as
            | 'none'
            | 'uppercase'
            | 'lowercase'
            | 'capitalize'
            | undefined,
          decoration,
          decorationStyle,
          decorationColor: style.textDecorationColor
            ? ck.parseColorString(style.textDecorationColor) || undefined
            : undefined,
          textShadow,
          fontFeatures,
        },
        rect.width || 1000,
      )
      .then((para) => {
        ctx.paragraph = para
        ctx.isBuilding = false
      })
      .catch((e) => {
        console.error(e)
        ctx.isBuilding = false
      })

    return // Skip draw execution
  }

  if (!ctx.isBuilding && ctx.paragraph) {
    canvas.drawParagraph(ctx.paragraph, rect.x, rect.y)
  }
}
