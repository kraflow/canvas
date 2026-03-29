import type { CanvasKit } from 'canvaskit-wasm'
import type { ViewStyle, TextStyle, ImageStyle, Color } from './types'

/* ============================================================
 * Resolved primitives — everything pre-computed to CK types
 * ============================================================ */

export interface ResolvedShadow {
  inset: boolean
  offsetX: number
  offsetY: number
  blurRadius: number
  spreadDistance: number
  color: Float32Array // already a CK Color4f
}

export interface ResolvedBorder {
  topWidth: number
  rightWidth: number
  bottomWidth: number
  leftWidth: number
  topColor: Float32Array
  rightColor: Float32Array
  bottomColor: Float32Array
  leftColor: Float32Array
  style: 'solid' | 'dashed' | 'dotted'
  isUniform: boolean // pre-computed — avoids re-checking every frame
}

export interface ResolvedRadius {
  tl: number
  tr: number
  br: number
  bl: number
  isUniform: boolean // pre-computed — fast path to drawRRect
}

export interface ResolvedViewStyle {
  // background
  backgroundColor: Float32Array | null
  // borders
  border: ResolvedBorder
  // radius
  radius: ResolvedRadius
  // shadows
  outsetShadows: ResolvedShadow[]
  insetShadows: ResolvedShadow[]
  // legacy iOS
  legacyShadow: { color: Float32Array; offsetX: number; offsetY: number; radius: number } | null
  // Android
  elevation: number
  // layer
  opacity: number
  needsLayer: boolean
  blendModeValue: number | null
  // overflow
  clipContent: boolean
  // outline
  outline: { color: Float32Array; width: number; style: string; offset: number } | null
}

export interface ResolvedTextStyle extends ResolvedViewStyle {
  // text
  color: Float32Array
  fontSize: number
  fontFamilies: string[]
  fontWeight: number
  italic: boolean
  letterSpacing: number | undefined
  heightMultiplier: number | undefined
  decoration: number
  decorationStyle: ReturnType<CanvasKit['DecorationStyle']['Solid']['valueOf']>
  decorationColor: Float32Array
  textAlignValue: number
  textDirectionRTL: boolean
  textAlignVertical: 'top' | 'center' | 'bottom'
  fontFeatures: { name: string; value: number }[] | undefined
  textShadow: { color: Float32Array; offsetX: number; offsetY: number; blurRadius: number } | null
  // pre-transformed text is NOT cached here — it depends on runtime content
}

export interface ResolvedImageStyle extends ResolvedViewStyle {
  mode: 'cover' | 'contain' | 'stretch' | 'fill' | 'repeat' | 'center' | 'scale-down'
  hasTint: boolean
  tintColor: Float32Array | null
}

/* ============================================================
 * StyleResolver
 * Call .resolveView / .resolveText / .resolveImage once when
 * style is set or updated. Pass the result to render functions.
 * ============================================================ */
export class StyleResolver {
  constructor(private readonly ck: CanvasKit) {}

  // ---- Public API ----

  resolveView(style: ViewStyle, containerSize: { w: number; h: number }): ResolvedViewStyle {
    return this.resolveBase(style, containerSize)
  }

  resolveText(style: TextStyle, containerSize: { w: number; h: number }): ResolvedTextStyle {
    const base = this.resolveBase(style, containerSize)
    const ck = this.ck

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

    const color = style.color ? this.parseColor(style.color) : ck.Color4f(0, 0, 0, 1)

    const decoration = (() => {
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
    })()

    const decorationStyle = (() => {
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
    })()

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

    const textShadow =
      style.textShadowColor && style.textShadowOffset
        ? {
            color: this.parseColor(style.textShadowColor),
            offsetX: style.textShadowOffset.width,
            offsetY: style.textShadowOffset.height,
            blurRadius: style.textShadowRadius ?? 0,
          }
        : null

    const heightMultiplier = style.lineHeight
      ? typeof style.lineHeight === 'number'
        ? style.lineHeight / fontSize
        : parseFloat(style.lineHeight) / 100
      : undefined

    return {
      ...base,
      color,
      fontSize,
      fontFamilies: style.fontFamily ? [style.fontFamily] : ['Roboto'],
      fontWeight:
        typeof style.fontWeight === 'number'
          ? style.fontWeight
          : (weightMap[style.fontWeight ?? 'normal'] ?? 400),
      italic: style.fontStyle === 'italic',
      letterSpacing: style.letterSpacing,
      heightMultiplier,
      decoration,
      decorationStyle,
      decorationColor: style.textDecorationColor
        ? this.parseColor(style.textDecorationColor)
        : color,
      textAlignValue,
      textDirectionRTL: style.writingDirection === 'rtl',
      textAlignVertical: (style.textAlignVertical as 'top' | 'center' | 'bottom') ?? 'top',
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
      textShadow,
    }
  }

  resolveImage(style: ImageStyle, containerSize: { w: number; h: number }): ResolvedImageStyle {
    const base = this.resolveBase(style, containerSize)
    const tintColor = style.tintColor ? this.parseColor(style.tintColor) : null
    return {
      ...base,
      mode: (style.objectFit ?? style.resizeMode ?? 'cover') as ResolvedImageStyle['mode'],
      hasTint: tintColor !== null,
      tintColor,
    }
  }

  // ---- Internal ----

  private resolveBase(style: ViewStyle, { w, h }: { w: number; h: number }): ResolvedViewStyle {
    const ck = this.ck
    const ref = Math.min(w, h)

    // --- radius ---
    const r = (v?: number | string) =>
      v !== undefined ? Math.min(this.parseLength(v, ref), ref / 2) : 0
    const tl = r(style.borderTopLeftRadius ?? style.borderStartStartRadius ?? style.borderRadius)
    const tr = r(style.borderTopRightRadius ?? style.borderStartEndRadius ?? style.borderRadius)
    const br = r(style.borderBottomRightRadius ?? style.borderEndEndRadius ?? style.borderRadius)
    const bl = r(style.borderBottomLeftRadius ?? style.borderEndStartRadius ?? style.borderRadius)
    const radius: ResolvedRadius = {
      tl,
      tr,
      br,
      bl,
      isUniform: tl === tr && tr === br && br === bl,
    }

    // --- borders ---
    const uniformW = style.borderWidth ?? 0
    const topWidth = style.borderTopWidth ?? uniformW
    const rightWidth = style.borderRightWidth ?? style.borderEndWidth ?? uniformW
    const bottomWidth = style.borderBottomWidth ?? uniformW
    const leftWidth = style.borderLeftWidth ?? style.borderStartWidth ?? uniformW
    //const fallback = ck.Color4f(0, 0, 0, 0)
    const topColor = this.parseColor(
      style.borderTopColor ?? style.borderStartColor ?? style.borderColor ?? 'transparent',
    )
    const rightColor = this.parseColor(
      style.borderRightColor ?? style.borderEndColor ?? style.borderColor ?? 'transparent',
    )
    const bottomColor = this.parseColor(
      style.borderBottomColor ?? style.borderColor ?? 'transparent',
    )
    const leftColor = this.parseColor(
      style.borderLeftColor ?? style.borderStartColor ?? style.borderColor ?? 'transparent',
    )
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
        this.colorEquals(topColor, rightColor) &&
        this.colorEquals(rightColor, bottomColor) &&
        this.colorEquals(bottomColor, leftColor),
    }

    // --- shadows ---
    const allShadows = this.normalizeShadows(style)
    const outsetShadows = allShadows.filter((s) => !s.inset)
    const insetShadows = allShadows.filter((s) => s.inset)

    // --- legacy iOS shadow ---
    let legacyShadow: ResolvedViewStyle['legacyShadow'] = null
    if (style.shadowColor && !style.boxShadow) {
      const col = this.parseColor(style.shadowColor)
      const alpha = (style.shadowOpacity ?? 1) * (col[3] ?? 1)
      legacyShadow = {
        color: ck.Color4f(col[0]!, col[1]!, col[2]!, alpha),
        offsetX: style.shadowOffset?.width ?? 0,
        offsetY: style.shadowOffset?.height ?? 0,
        radius: style.shadowRadius ?? 0,
      }
    }

    // --- blend mode ---
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

    // --- outline ---
    let outline: ResolvedViewStyle['outline'] = null
    if (style.outlineWidth && style.outlineColor) {
      outline = {
        color: this.parseColor(style.outlineColor),
        width: this.parseLength(style.outlineWidth, w),
        style: style.outlineStyle ?? 'solid',
        offset: style.outlineOffset ? this.parseLength(style.outlineOffset, w) : 0,
      }
    }

    return {
      backgroundColor:
        style.backgroundColor && style.backgroundColor !== 'transparent'
          ? this.parseColor(style.backgroundColor)
          : null,
      border,
      radius,
      outsetShadows,
      insetShadows,
      legacyShadow,
      elevation: style.elevation ?? 0,
      opacity,
      needsLayer: opacity < 1 || blendModeValue !== null,
      blendModeValue,
      clipContent: style.overflow === 'hidden',
      outline,
    }
  }

  // ---- Color parsing (moved here, called once) ----

  parseColor(color: Color): Float32Array {
    const ck = this.ck
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

  parseLength(value: number | string, reference: number): number {
    if (typeof value === 'number') return value
    if (value.endsWith('%')) return (parseFloat(value) / 100) * reference
    if (value.endsWith('px')) return parseFloat(value)
    return parseFloat(value)
  }

  // ---- Helpers ----

  private colorEquals(a: Float32Array, b: Float32Array): boolean {
    return a[0] === b[0] && a[1] === b[1] && a[2] === b[2] && a[3] === b[3]
  }

  private normalizeShadows(style: ViewStyle): ResolvedShadow[] {
    if (!style.boxShadow) return []
    const parse = (str: string): ResolvedShadow => {
      const parts = str.trim().split(/\s+/)
      const inset = parts[0] === 'inset'
      const tokens = inset ? parts.slice(1) : parts
      const nums = tokens.filter((p) => /^-?[\d.]+px$/.test(p))
      const colorStr = tokens.filter((p) => !/^-?[\d.]+px$/.test(p)).join(' ') || 'black'
      return {
        inset,
        offsetX: parseFloat(nums[0] ?? '0'),
        offsetY: parseFloat(nums[1] ?? '0'),
        blurRadius: parseFloat(nums[2] ?? '0'),
        spreadDistance: parseFloat(nums[3] ?? '0'),
        color: this.parseColor(colorStr as Color),
      }
    }
    if (typeof style.boxShadow === 'string') return [parse(style.boxShadow)]
    if (Array.isArray(style.boxShadow)) {
      return style.boxShadow.map((entry) => {
        if (typeof entry === 'string') return parse(entry)
        return {
          inset: entry.inset ?? false,
          offsetX: this.parseLength(entry.offsetX as number | string, 0),
          offsetY: this.parseLength(entry.offsetY as number | string, 0),
          blurRadius: entry.blurRadius
            ? this.parseLength(entry.blurRadius as number | string, 0)
            : 0,
          spreadDistance: entry.spreadDistance
            ? this.parseLength(entry.spreadDistance as number | string, 0)
            : 0,
          color: this.parseColor(((entry.color as string | undefined) ?? 'black') as Color),
        }
      })
    }
    return []
  }
}
