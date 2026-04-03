import type {
  CanvasKit,
  EmbindEnumEntity,
  FontMgr,
  FontStyle,
  Paragraph,
  ParagraphStyle,
  TextStyle,
} from 'canvaskit-wasm'
import type { TextSegment } from './text-segmenter'

export interface ParagraphOptions {
  // ── typography ──────────────────────────────────────────────
  fontSize?: number
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

  // ── legacy ──────────────────────────────────────────────────
  fontStyle?: Partial<{ weight: number; slant: number }>
}

// ─── defaults ────────────────────────────────────────────────────────────────

const DEFAULT_COLOR = new Float32Array([0, 0, 0, 1])

function defaults(ck: CanvasKit, opts: ParagraphOptions) {
  return {
    fontSize: opts.fontSize ?? 14,
    color: opts.color ?? DEFAULT_COLOR,
    fontFamilies: opts.fontFamilies ?? [],
    fontWeight: opts.fontWeight ?? 400,
    italic: opts.italic ?? false,
    letterSpacing: opts.letterSpacing ?? 0,
    heightMultiplier:
      opts.heightMultiplier ??
      (opts.lineHeight && opts.fontSize ? opts.lineHeight / opts.fontSize : 1.2),
    fontFeatures: opts.fontFeatures ?? undefined,
    textAlignValue: opts.textAlignValue ?? 0, // CanvasKit.TextAlign.Left
    textDirectionRTL: opts.textDirectionRTL ?? false,
    textAlignVertical: opts.textAlignVertical ?? 'top',
    textTransform: opts.textTransform ?? 'none',
    decoration: opts.decoration ?? 0,
    decorationStyle: opts.decorationStyle ?? ck.DecorationStyle.Solid,
    decorationColor: opts.decorationColor ?? opts.color ?? DEFAULT_COLOR,
    textShadow: opts.textShadow ?? null,
    fontStyle: opts.fontStyle ?? undefined,
  } as const
}

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

// ─── builder ─────────────────────────────────────────────────────────────────

export function buildParagraph(
  ck: CanvasKit,
  fontMgr: FontMgr,
  segments: TextSegment[],
  opts: ParagraphOptions,
  maxWidth: number,
): Paragraph {
  const o = defaults(ck, opts)

  // ── ParagraphStyle ───────────────────────────────────────────
  const paraStyle = new ck.ParagraphStyle({
    textAlign: { value: o.textAlignValue },
    textDirection: o.textDirectionRTL ? ck.TextDirection.RTL : ck.TextDirection.LTR,
    textStyle: {
      color: o.color,
      fontSize: o.fontSize,
      fontFamilies: segments.map((s) => s.family),
      letterSpacing: o.letterSpacing,
      heightMultiplier: o.heightMultiplier,
      fontStyle: {
        weight: { value: o.fontWeight },
        width: ck.FontWidth ? ck.FontWidth.Normal : { value: 5 },
        slant: o.italic ? ck.FontSlant.Italic : ck.FontSlant.Upright,
      },
      decoration: o.decoration,
      decorationStyle: o.decorationStyle,
      decorationColor: o.decorationColor,
      fontFeatures: o.fontFeatures,
      shadows: o.textShadow
        ? [
            {
              color: o.textShadow.color,
              offset: [o.textShadow.offsetX, o.textShadow.offsetY] as [number, number],
              blurRadius: o.textShadow.blurRadius,
            },
          ]
        : undefined,
    },
  } as ParagraphStyle)

  // ── ParagraphBuilder ─────────────────────────────────────────
  const builder = ck.ParagraphBuilder.Make(paraStyle, fontMgr)

  for (const seg of segments) {
    const ts = new ck.TextStyle({}) as TextStyle

    // every property set per-segment so each run is fully self-contained
    ts.color = o.color
    ts.fontSize = o.fontSize
    ts.fontFamilies = [seg.family, ...o.fontFamilies] // segment family first, then fallbacks
    ts.letterSpacing = o.letterSpacing
    ts.heightMultiplier = o.heightMultiplier
    ts.fontStyle = (o.fontStyle || {
      weight: { value: o.fontWeight },
      width: ck.FontWidth ? ck.FontWidth.Normal : { value: 5 },
      slant: o.italic ? ck.FontSlant.Italic : ck.FontSlant.Upright,
    }) as FontStyle
    ts.decoration = o.decoration
    ts.decorationStyle = o.decorationStyle
    ts.decorationColor = o.decorationColor

    if (o.fontFeatures) ts.fontFeatures = o.fontFeatures

    if (o.textShadow) {
      ts.shadows = [
        {
          color: o.textShadow.color,
          offset: [o.textShadow.offsetX, o.textShadow.offsetY] as [number, number],
          blurRadius: o.textShadow.blurRadius,
        },
      ]
    }

    builder.pushStyle(ts)
    builder.addText(applyTextTransform(seg.text, o.textTransform))
    builder.pop()
  }

  const para = builder.build()
  para.layout(maxWidth)
  builder.delete()

  return para
}
