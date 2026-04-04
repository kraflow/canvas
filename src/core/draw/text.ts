import type { Canvas } from 'canvaskit-wasm'
import type { ResolvedTextStyle } from '@/core/styles'
import type { FontSystem } from '@/core/fonts'
import type { LayoutRectRect } from './types'

export function text(
  canvas: Canvas,
  fontSystem: FontSystem,
  rs: ResolvedTextStyle,
  content: string,
  rect: LayoutRectRect,
) {
  if (!rs.display) return

  // Text Transform handling
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

  try {
    const para = fontSystem.makeParagraphSync(
      text,
      rs.fontFamilies?.[0] || 'Inter',
      {
        fontSize: rs.fontSize,
        color: rs.color,
        fontWeight: rs.fontWeight,
        letterSpacing: rs.letterSpacing,
        lineHeight: rs.heightMultiplier,
        italic: rs.italic,
        textAlignValue: rs.textAlignValue,
        textDirectionRTL: rs.textDirectionRTL,
        textAlignVertical: rs.textAlignVertical,
        textTransform: undefined, // handled above
        decoration: rs.decoration,
        decorationStyle: rs.decorationStyle,
        decorationColor: rs.decorationColor,
        textShadow: rs.textShadow || undefined,
        fontFeatures: rs.fontFeatures,
        heightMultiplier: rs.heightMultiplier,
      },
      rect.w || 1000,
    )

    let textY = rect.y
    if (rs.textAlignVertical === 'center') {
      textY = rect.y + (rect.h - para.getHeight()) / 2
    } else if (rs.textAlignVertical === 'bottom') {
      textY = rect.y + rect.h - para.getHeight()
    }

    canvas.drawParagraph(para, rect.x, textY)

    // Always delete CanvasKit objects in WASM!
    para.delete()
  } catch (e) {
    console.error('[text rendering error]', e)
  }
}
