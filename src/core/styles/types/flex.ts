/** A numeric size or a percentage string, e.g. 100 | '50%' | 'auto' */
export type DimensionValue = number | string | null | undefined

export interface FlexStyle {
  /** Default: 'column' */
  flexDirection?: 'row' | 'row-reverse' | 'column' | 'column-reverse'
  /** Default: 'nowrap' */
  flexWrap?: 'wrap' | 'nowrap' | 'wrap-reverse'
  /** Default: 'flex-start' */
  justifyContent?:
    | 'flex-start'
    | 'flex-end'
    | 'center'
    | 'space-between'
    | 'space-around'
    | 'space-evenly'
  /** Default: 'stretch' */
  alignItems?: 'flex-start' | 'flex-end' | 'center' | 'stretch' | 'baseline'
  /** Default: 'stretch' */
  alignContent?:
    | 'flex-start'
    | 'flex-end'
    | 'center'
    | 'stretch'
    | 'space-between'
    | 'space-around'
    | 'space-evenly'

  // ── Flex item ───────────────────────────────────────────────────────────────
  /** Shorthand: positive → flexGrow + flexShrink:1 + flexBasis:0; 0 → rigid; -1 → shrinks to min */
  flex?: number
  flexGrow?: number
  flexShrink?: number
  flexBasis?: number | string
  /** Default: 'auto' */
  alignSelf?: 'auto' | 'flex-start' | 'flex-end' | 'center' | 'stretch' | 'baseline'

  // ── Sizing ──────────────────────────────────────────────────────────────────
  width?: DimensionValue
  height?: DimensionValue
  minWidth?: DimensionValue
  maxWidth?: DimensionValue
  minHeight?: DimensionValue
  maxHeight?: DimensionValue
  /** number | string ratio e.g. 16/9 or '16/9' */
  aspectRatio?: number | string

  // ── Box model ───────────────────────────────────────────────────────────────
  /** Default: 'border-box' */
  boxSizing?: 'border-box' | 'content-box'

  // ── Position ────────────────────────────────────────────────────────────────
  /** Default: 'relative' */
  position?: 'absolute' | 'relative' | 'static'
  top?: DimensionValue
  bottom?: DimensionValue
  left?: DimensionValue
  right?: DimensionValue
  /** LTR=right, RTL=left */
  end?: DimensionValue
  start?: DimensionValue
  /** Shorthand for top, right, bottom, left */
  inset?: DimensionValue
  /** Shorthand for top and bottom */
  insetBlock?: DimensionValue
  /** Top position in logical terms */
  insetBlockStart?: DimensionValue
  /** Bottom position in logical terms */
  insetBlockEnd?: DimensionValue
  /** Shorthand for left and right */
  insetInline?: DimensionValue
  /** Start position in logical terms (LTR: left, RTL: right) */
  insetInlineStart?: DimensionValue
  /** End position in logical terms (LTR: right, RTL: left) */
  insetInlineEnd?: DimensionValue

  // ── Margin ──────────────────────────────────────────────────────────────────
  margin?: DimensionValue
  marginTop?: DimensionValue
  marginBottom?: DimensionValue
  marginLeft?: DimensionValue
  marginRight?: DimensionValue
  marginHorizontal?: DimensionValue
  marginVertical?: DimensionValue
  /** LTR=marginRight, RTL=marginLeft */
  marginEnd?: DimensionValue
  /** LTR=marginLeft, RTL=marginRight */
  marginStart?: DimensionValue
  /** Equivalent to marginVertical */
  marginBlock?: DimensionValue
  marginBlockStart?: DimensionValue
  marginBlockEnd?: DimensionValue
  /** Equivalent to marginHorizontal */
  marginInline?: DimensionValue
  marginInlineStart?: DimensionValue
  marginInlineEnd?: DimensionValue

  // ── Padding ─────────────────────────────────────────────────────────────────
  padding?: DimensionValue
  paddingTop?: DimensionValue
  paddingBottom?: DimensionValue
  paddingLeft?: DimensionValue
  paddingRight?: DimensionValue
  paddingHorizontal?: DimensionValue
  paddingVertical?: DimensionValue
  /** LTR=paddingRight, RTL=paddingLeft */
  paddingEnd?: DimensionValue
  /** LTR=paddingLeft, RTL=paddingRight */
  paddingStart?: DimensionValue
  /** Equivalent to paddingVertical */
  paddingBlock?: DimensionValue
  paddingBlockStart?: DimensionValue
  paddingBlockEnd?: DimensionValue
  /** Equivalent to paddingHorizontal */
  paddingInline?: DimensionValue
  paddingInlineStart?: DimensionValue
  paddingInlineEnd?: DimensionValue

  // ── Border widths (layout contribution) ─────────────────────────────────────
  borderWidth?: number
  borderTopWidth?: number
  borderBottomWidth?: number
  borderLeftWidth?: number
  borderRightWidth?: number
  borderEndWidth?: number
  borderStartWidth?: number

  // ── Gap ─────────────────────────────────────────────────────────────────────
  gap?: DimensionValue
  rowGap?: DimensionValue
  columnGap?: DimensionValue

  // ── Display / direction / z ──────────────────────────────────────────────────
  /** Default: 'flex' */
  display?: 'none' | 'flex' | 'contents'
  /** Default: 'inherit' */
  direction?: 'inherit' | 'ltr' | 'rtl'
  zIndex?: number

  // ── Overflow ────────────────────────────────────────────────────────────────
  /** Default: 'visible' */
  overflow?: 'visible' | 'hidden' | 'scroll'

  // ── Stacking context ────────────────────────────────────────────────────────
  /** Default: 'auto' */
  isolation?: 'auto' | 'isolate'
}
