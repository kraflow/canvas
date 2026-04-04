import type { ColorValue, ViewStyle } from './view'

export interface TextStyle extends ViewStyle {
  // ── Color ───────────────────────────────────────────────────────────────────
  color?: ColorValue

  // ── Font ────────────────────────────────────────────────────────────────────
  fontFamily?: string
  fontSize?: number
  fontStyle?: 'normal' | 'italic'
  /**
   * Accepts string enum OR numeric weight (100–900).
   * Default: 'normal'
   */
  fontWeight?:
    | 'normal'
    | 'bold'
    | '100'
    | '200'
    | '300'
    | '400'
    | '500'
    | '600'
    | '700'
    | '800'
    | '900'
    | 100
    | 200
    | 300
    | 400
    | 500
    | 600
    | 700
    | 800
    | 900

  /**
   * Accepts array of enum values or a space-separated string.
   * e.g. ['small-caps', 'tabular-nums'] or 'small-caps tabular-nums'
   * Default: []
   */
  fontVariant?:
    | Array<'small-caps' | 'oldstyle-nums' | 'lining-nums' | 'tabular-nums' | 'proportional-nums'>
    | string

  // ── Spacing ─────────────────────────────────────────────────────────────────
  letterSpacing?: number
  lineHeight?: number

  // ── Alignment ───────────────────────────────────────────────────────────────
  /**
   * Default: 'auto'
   * On Android, 'justify' requires API 26+.
   */
  textAlign?: 'auto' | 'left' | 'right' | 'center' | 'justify'
  /**
   * Android only. Default: 'auto'
   */
  textAlignVertical?: 'auto' | 'top' | 'bottom' | 'center'
  /**
   * Android only. Alias for textAlignVertical with extra 'middle' value. Default: 'auto'
   */
  verticalAlign?: 'auto' | 'top' | 'bottom' | 'middle'

  // ── Decoration ──────────────────────────────────────────────────────────────
  /** Default: 'none' */
  textDecorationLine?: 'none' | 'underline' | 'line-through' | 'underline line-through'
  /** iOS only. Default: 'solid' */
  textDecorationStyle?: 'solid' | 'double' | 'dotted' | 'dashed'
  /** iOS only */
  textDecorationColor?: ColorValue

  // ── Shadow ──────────────────────────────────────────────────────────────────
  textShadowColor?: ColorValue
  textShadowOffset?: { width?: number; height?: number }
  textShadowRadius?: number

  // ── Transform ───────────────────────────────────────────────────────────────
  /** Default: 'none' */
  textTransform?: 'none' | 'uppercase' | 'lowercase' | 'capitalize'

  // ── Selection ───────────────────────────────────────────────────────────────
  /** Default: 'none'. Takes precedence over the `selectable` prop. */
  userSelect?: 'auto' | 'text' | 'none' | 'contain' | 'all'

  // ── Writing direction ────────────────────────────────────────────────────────
  /** iOS only. Default: 'auto' */
  writingDirection?: 'auto' | 'ltr' | 'rtl'

  // ── Android specifics ────────────────────────────────────────────────────────
  /**
   * Android only. Default: true.
   * Set false to remove extra ascender/descender padding.
   * Pair with textAlignVertical: 'center' for best results.
   */
  includeFontPadding?: boolean
}
