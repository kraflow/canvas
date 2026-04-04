import type {
  CanvasKit,
  EmbindEnumEntity,
  FontMgr,
  Paragraph,
  ParagraphStyle,
  TextStyle,
} from 'canvaskit-wasm'
import type { TextSegment } from './text-segmenter'

export interface ParagraphOptions {
  // ── typography ──────────────────────────────────────────────
  fontSize: number
  color?: Float32Array
  fontFamilies?: string[]
  fontWeight?: number
  italic?: boolean
  letterSpacing?: number
  lineHeight?: number
  heightMultiplier?: number
  fontFeatures?: { name: string; value: number }[]

  // ── layout ──────────────────────────────────────────────────
  textAlignValue?: number
  textDirectionRTL?: boolean
  textAlignVertical?: 'top' | 'center' | 'bottom'
  textTransform?: 'none' | 'uppercase' | 'lowercase' | 'capitalize'

  // ── decoration ──────────────────────────────────────────────
  decoration?: number
  decorationStyle?: EmbindEnumEntity
  decorationColor?: Float32Array

  // ── shadow ──────────────────────────────────────────────────
  textShadow?: {
    color: Float32Array
    offsetX: number
    offsetY: number
    blurRadius: number
  } | null
}

// ─── defaults ────────────────────────────────────────────────────────────────

const DEFAULT_COLOR = new Float32Array([0, 0, 0, 1])

// ─── text transform ───────────────────────────────────────────────────────────

export function applyTextTransform(
  text: string,
  transform: ParagraphOptions['textTransform'],
): string {
  switch (transform) {
    case 'uppercase':
      return text.toUpperCase()
    case 'lowercase':
      return text.toLowerCase()
    case 'capitalize':
      return text.replace(/\b\w/g, (c) => c.toUpperCase())
    default:
      return text
  }
}

// ─── helpers ─────────────────────────────────────────────────────────────────

/** Resolve shadow array once — shared between ParagraphStyle and per-segment styles. */
function resolveShadows(
  textShadow: ParagraphOptions['textShadow'],
): { color: Float32Array; offset: [number, number]; blurRadius: number }[] | undefined {
  if (!textShadow) return undefined
  return [
    {
      color: textShadow.color,
      offset: [textShadow.offsetX, textShadow.offsetY],
      blurRadius: textShadow.blurRadius,
    },
  ]
}

/** Build the shared TextStyle fields that both ParagraphStyle and per-segment styles use. */
function resolveBaseTextStyle(ck: CanvasKit, o: ParagraphOptions, families: string[]): TextStyle {
  return new ck.TextStyle({
    color: o.color ?? DEFAULT_COLOR,
    fontSize: o.fontSize,
    fontFamilies: families,
    letterSpacing: o.letterSpacing,
    heightMultiplier: o.heightMultiplier,
    fontStyle: {
      weight: { value: o.fontWeight! },
      width: ck.FontWidth ? ck.FontWidth.Normal : { value: 5 },
      slant: o.italic ? ck.FontSlant.Italic : ck.FontSlant.Upright,
    },
    decoration: o.decoration,
    decorationStyle: o.decorationStyle,
    decorationColor: o.decorationColor,
    fontFeatures: o.fontFeatures,
    shadows: resolveShadows(o.textShadow),
  } as TextStyle)
}

// ─── builder ─────────────────────────────────────────────────────────────────

export function buildParagraph(
  ck: CanvasKit,
  fontMgr: FontMgr,
  segments: TextSegment[],
  opts: ParagraphOptions,
  maxWidth: number,
): Paragraph {
  const o = opts
  const extraFamilies = o.fontFamilies || []

  const allFamilies = [...segments.map((s) => s.family), ...extraFamilies]

  const paraStyle = new ck.ParagraphStyle({
    textAlign: o.textAlignValue,
    textDirection: o.textDirectionRTL ? ck.TextDirection.RTL : ck.TextDirection.LTR,
    textStyle: resolveBaseTextStyle(ck, o, allFamilies),
  } as ParagraphStyle)

  const builder = ck.ParagraphBuilder.Make(paraStyle, fontMgr)

  for (const seg of segments) {
    const segFamilies = [seg.family, ...extraFamilies]

    builder.pushStyle(resolveBaseTextStyle(ck, o, segFamilies))
    builder.addText(applyTextTransform(seg.text, o.textTransform))
    builder.pop()
  }

  const para = builder.build()
  para.layout(maxWidth)

  builder.delete()

  return para
}
