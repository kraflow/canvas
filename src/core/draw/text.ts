import type { Canvas, CanvasKit, Paragraph } from 'canvaskit-wasm'
import type { TextStyle } from '@/core/styles'
import type { FontSystem } from '@/core/fonts'
import type { Rect } from './types'

interface CompiledText {
  content: string
  paragraph: Paragraph | null
  isBuilding: boolean
}

const compileCache = new WeakMap<TextStyle, CompiledText>()

export function text(
  ck: CanvasKit,
  canvas: Canvas,
  fontSystem: FontSystem,
  style: TextStyle,
  content: string,
  rect: Rect,
) {
  let compiled = compileCache.get(style)

  // First frame encounter or updated string input => Cache Miss.
  if (!compiled || compiled.content !== content) {
    if (compiled?.paragraph) {
      compiled.paragraph.delete() // clean up old C++ allocations memory leaks
    }

    compiled = {
      content,
      paragraph: null,
      isBuilding: true,
    }
    compileCache.set(style, compiled)

    // Fire asynchronous background paragraph loading (Font Web Assembly parsing)
    // This will trigger web fetch rules if fallbacks are missing.
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
        rect.width || 1000, // default wrap bound boundary parameter
      )
      .then((para) => {
        // Re-hydrate UI on resolution
        if (compiled) {
          compiled.paragraph = para
          compiled.isBuilding = false
        }
      })
      .catch(console.error)

    return // Skip draw execution since Para isn't populated
  }

  // Draw if mapping is fully built bridging asynchronously into rendering cycle.
  if (!compiled.isBuilding && compiled.paragraph) {
    canvas.drawParagraph(compiled.paragraph, rect.x, rect.y)
  }
}
