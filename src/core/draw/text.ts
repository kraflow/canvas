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

    fontSystem
      .makeParagraph(
        content,
        style.fontFamily || 'Inter',
        {
          fontSize: style.fontSize,
          color: style.color ? ck.parseColorString(style.color) : undefined,
          fontWeight: style.fontWeight === 'bold' ? 700 : Number(style.fontWeight) || 400,
          letterSpacing: style.letterSpacing,
          lineHeight: style.lineHeight,
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
