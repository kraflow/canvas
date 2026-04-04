import type { CanvasKit } from 'canvaskit-wasm'
import type { ViewStyle, TextStyle, ImageStyle } from './types'
import type {
  ResolvedViewStyle,
  ResolvedTextStyle,
  ResolvedImageStyle,
  ResolvedRadius,
  ResolvedBorder,
  ResolvedShadow,
} from './resolved'

export * from './resolved'

// --- Internal Parsers ---

function parseColor(ck: CanvasKit, color: string): Float32Array {
  const c = color.trim()

  const rgba = c.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)$/)
  if (rgba)
    return ck.Color4f(
      +rgba[1]! / 255,
      +rgba[2]! / 255,
      +rgba[3]! / 255,
      rgba[4] != null ? +rgba[4] : 1,
    )

  const hsla = c.match(/^hsla?\((\d+),\s*([\d.]+)%,\s*([\d.]+)%(?:,\s*([\d.]+))?\)$/)
  if (hsla) {
    const h = +hsla[1]! / 360,
      s = +hsla[2]! / 100,
      l = +hsla[3]! / 100,
      a = hsla[4] != null ? +hsla[4] : 1
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s,
      p = 2 * l - q
    const hue = (t: number) => {
      t = ((t % 1) + 1) % 1
      if (t < 1 / 6) return p + (q - p) * 6 * t
      if (t < 0.5) return q
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
      return p
    }
    return ck.Color4f(hue(h + 1 / 3), hue(h), hue(h - 1 / 3), a)
  }

  if (c.startsWith('#')) {
    const h = c.slice(1)
    if (h.length === 3)
      return ck.Color4f(
        ...(h.split('').map((x) => parseInt(x + x, 16) / 255) as [number, number, number]),
        1,
      )
    if (h.length === 6)
      return ck.Color4f(
        parseInt(h.slice(0, 2), 16) / 255,
        parseInt(h.slice(2, 4), 16) / 255,
        parseInt(h.slice(4, 6), 16) / 255,
        1,
      )
    if (h.length === 8)
      return ck.Color4f(
        parseInt(h.slice(0, 2), 16) / 255,
        parseInt(h.slice(2, 4), 16) / 255,
        parseInt(h.slice(4, 6), 16) / 255,
        parseInt(h.slice(6, 8), 16) / 255,
      )
  }

  const named: Record<string, [number, number, number, number]> = {
    transparent: [0, 0, 0, 0],
    black: [0, 0, 0, 1],
    white: [1, 1, 1, 1],
    red: [1, 0, 0, 1],
    green: [0, 0.502, 0, 1],
    blue: [0, 0, 1, 1],
    gray: [0.502, 0.502, 0.502, 1],
    grey: [0.502, 0.502, 0.502, 1],
    yellow: [1, 1, 0, 1],
    orange: [1, 0.647, 0, 1],
    purple: [0.502, 0, 0.502, 1],
    pink: [1, 0.753, 0.796, 1],
    cyan: [0, 1, 1, 1],
    magenta: [1, 0, 1, 1],
  }
  const n = named[c.toLowerCase()]
  return n ? ck.Color4f(...n) : ck.Color4f(0, 0, 0, 1)
}

function parseLength(value: number | string): number {
  if (typeof value === 'number') return value
  return parseFloat(value)
}

function colorEquals(a: Float32Array, b: Float32Array): boolean {
  return a[0] === b[0] && a[1] === b[1] && a[2] === b[2] && a[3] === b[3]
}

function normalizeShadows(ck: CanvasKit, style: ViewStyle): ResolvedShadow[] {
  if (!style.boxShadow) return []

  return style.boxShadow.map((entry) => {
    return {
      inset: entry.inset ?? false,
      offsetX: parseLength(entry.offsetX as number | string),
      offsetY: parseLength(entry.offsetY as number | string),
      blurRadius: entry.blurRadius ? parseLength(entry.blurRadius as number | string) : 0,
      spreadDistance: entry.spreadDistance
        ? parseLength(entry.spreadDistance as number | string)
        : 0,
      color: parseColor(ck, (entry.color as string | undefined) ?? 'black'),
    }
  })
}

// --- Factory Functions ---

export function resolveViewStyle(ck: CanvasKit, style: ViewStyle): ResolvedViewStyle {
  const r = (v?: number | string) => (v !== undefined ? parseLength(v) : 0)
  const tl = r(style.borderTopLeftRadius ?? style.borderRadius)
  const tr = r(style.borderTopRightRadius ?? style.borderRadius)
  const br = r(style.borderBottomRightRadius ?? style.borderRadius)
  const bl = r(style.borderBottomLeftRadius ?? style.borderRadius)
  const radius: ResolvedRadius = {
    tl,
    tr,
    br,
    bl,
    isUniform: tl === tr && tr === br && br === bl,
  }

  const uniformW = style.borderWidth ?? 0
  const topWidth = style.borderTopWidth ?? uniformW
  const rightWidth = style.borderRightWidth ?? uniformW
  const bottomWidth = style.borderBottomWidth ?? uniformW
  const leftWidth = style.borderLeftWidth ?? uniformW

  const topColor = parseColor(ck, style.borderTopColor ?? style.borderColor ?? 'transparent')
  const rightColor = parseColor(ck, style.borderRightColor ?? style.borderColor ?? 'transparent')
  const bottomColor = parseColor(ck, style.borderBottomColor ?? style.borderColor ?? 'transparent')
  const leftColor = parseColor(ck, style.borderLeftColor ?? style.borderColor ?? 'transparent')

  const border: ResolvedBorder = {
    topWidth,
    rightWidth,
    bottomWidth,
    leftWidth,

    topColor,
    rightColor,
    bottomColor,
    leftColor,
    style: (style.borderStyle ?? 'solid') as ResolvedBorder['style'],
    isUniform:
      topWidth === rightWidth &&
      rightWidth === bottomWidth &&
      bottomWidth === leftWidth &&
      topWidth > 0 &&
      colorEquals(topColor, rightColor) &&
      colorEquals(rightColor, bottomColor) &&
      colorEquals(bottomColor, leftColor),
  }

  const allShadows = normalizeShadows(ck, style)
  const outsetShadows = allShadows.filter((s) => !s.inset)
  const insetShadows = allShadows.filter((s) => s.inset)

  const blendModeMap: Record<string, number> = {
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
  const opacity = style.opacity ?? 1
  const blendModeValue =
    style.mixBlendMode && style.mixBlendMode !== 'normal'
      ? (blendModeMap[style.mixBlendMode] ?? null)
      : null

  let outline: ResolvedViewStyle['outline'] = null
  if (style.outlineWidth && style.outlineColor) {
    outline = {
      color: parseColor(ck, style.outlineColor),
      width: parseLength(style.outlineWidth),
      style: style.outlineStyle ?? 'solid',
      offset: style.outlineOffset ? parseLength(style.outlineOffset) : 0,
    }
  }

  // Pre-parse the filters
  let filterEntries: Array<{ blur?: number }> | null = null
  if (Array.isArray(style.filter) && style.filter.length > 0) {
    filterEntries = []
    ;(style.filter as { blur?: string | number }[]).forEach((f) => {
      if ('blur' in f) {
        filterEntries!.push({ blur: parseLength(f.blur as string) })
      }
      // TODO: implement other filters
    })
  }

  return {
    backgroundColor:
      style.backgroundColor && style.backgroundColor !== 'transparent'
        ? parseColor(ck, style.backgroundColor)
        : null,
    border,
    radius,
    outsetShadows,
    insetShadows,
    opacity,
    needsLayer: opacity < 1 || blendModeValue !== null || filterEntries !== null,
    blendModeValue,
    filterEntries,
    transform: style.transform,
    transformOrigin: style.transformOrigin,
    clipContent: style.overflow === 'hidden' || style.overflow === 'scroll',
    outline,
    display: style.display !== 'none',
  }
}

export function resolveTextStyle(ck: CanvasKit, style: TextStyle): ResolvedTextStyle {
  const resolvedBase = resolveViewStyle(ck, style)

  const fontSize = style.fontSize ?? 16
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

  const textAlignValue =
    (style.textAlign &&
      {
        left: ck.TextAlign.Left.value,
        right: ck.TextAlign.Right.value,
        center: ck.TextAlign.Center.value,
        justify: ck.TextAlign.Justify.value,
        auto: ck.TextAlign.Start.value,
      }[style.textAlign]) ||
    ck.TextAlign.Start.value

  const heightMultiplier = style.lineHeight
    ? typeof style.lineHeight === 'number'
      ? style.lineHeight / fontSize
      : parseFloat(style.lineHeight) / 100
    : undefined

  const decoration =
    (style.textDecorationLine &&
      {
        underline: ck.UnderlineDecoration,
        'line-through': ck.LineThroughDecoration,
        'underline line-through': ck.UnderlineDecoration | ck.LineThroughDecoration,
        none: 0,
      }[style.textDecorationLine]) ||
    0

  const decorationStyle =
    (style.textDecorationStyle &&
      {
        solid: ck.DecorationStyle.Solid,
        double: ck.DecorationStyle.Double,
        dashed: ck.DecorationStyle.Dashed,
        dotted: ck.DecorationStyle.Dotted,
      }[style.textDecorationStyle]) ||
    ck.DecorationStyle.Solid

  const textShadow =
    (style.textShadowColor &&
      style.textShadowOffset && {
        color: parseColor(ck, style.textShadowColor),
        offsetX: style.textShadowOffset.width,
        offsetY: style.textShadowOffset.height,
        blurRadius: style.textShadowRadius ?? 0,
      }) ||
    undefined

  const color = style.color ? parseColor(ck, style.color) : undefined

  return {
    ...resolvedBase,
    fontSize,
    fontFamilies: style.fontFamily ? [style.fontFamily] : ['Roboto'],
    fontWeight:
      typeof style.fontWeight === 'number'
        ? style.fontWeight
        : (weightMap[style.fontWeight ?? 'normal'] ?? 400),
    italic: style.fontStyle === 'italic',
    letterSpacing: style.letterSpacing,
    heightMultiplier,
    textAlignValue,
    textDirectionRTL: style.writingDirection === 'rtl',
    fontFeatures: style.fontVariant?.map((v) => {
      const map: Record<string, string> = {
        'small-caps': 'smcp',
        'oldstyle-nums': 'onum',
        'lining-nums': 'lnum',
        'tabular-nums': 'tnum',
        'proportional-nums': 'pnum',
      }
      return { name: map[v] ?? v, value: 1 }
    }),
    textTransform: style.textTransform ?? 'none',
    color: style.color ? parseColor(ck, style.color) : ck.Color4f(0, 0, 0, 1),
    decoration,
    decorationStyle,
    decorationColor: style.textDecorationColor ? parseColor(ck, style.textDecorationColor) : color,
    textAlignVertical: (style.textAlignVertical as 'top' | 'center' | 'bottom') ?? 'top',
    textShadow,
  }
}

export function resolveImageStyle(ck: CanvasKit, style: ImageStyle): ResolvedImageStyle {
  const base = resolveViewStyle(ck, style)
  const tintColor = style.tintColor ? parseColor(ck, style.tintColor) : undefined
  const overlayColor = style.overlayColor ? parseColor(ck, style.overlayColor) : undefined

  return {
    ...base,
    mode: (style.objectFit ?? style.resizeMode ?? 'cover') as ResolvedImageStyle['mode'],
    tintColor,
    overlayColor,
  }
}
