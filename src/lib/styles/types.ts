/* ============================================================
 * React Native Core Style Types — Latest (0.76+ / New Arch default)
 * Officially supported runtime properties only
 * New Architecture features (boxShadow, filter, mixBlendMode, etc.)
 * ============================================================ */

/* ------------------------------------------------------------
 * Shared primitives
 * ------------------------------------------------------------ */
export type HexColor = `#${string}`
export type RGBColor = `rgb(${number}, ${number}, ${number})`
export type RGBAColor = `rgba(${number}, ${number}, ${number}, ${number})`
export type HSLColor = `hsl(${number}, ${number}%, ${number}%)`
export type HSLAColor = `hsla(${number}, ${number}%, ${number}%, ${number})`

export type NamedColor =
  | 'transparent'
  | 'currentColor'
  | 'black'
  | 'white'
  | 'red'
  | 'green'
  | 'blue'
  // Add more named colors as needed (React Native supports most CSS named colors)
  | string // fallback for any valid named color

export type Color = HexColor | RGBColor | RGBAColor | HSLColor | HSLAColor | NamedColor

export type Length = number | `${number}%` | `${number}px` // px unit increasingly supported in newer styles

export type DimensionValue = Length | 'auto' | `${number}` // common alias used internally

/* ------------------------------------------------------------
 * Flex Styles (shared)
 * ------------------------------------------------------------ */
export interface FlexStyle {
  /* Layout */
  width?: DimensionValue
  height?: DimensionValue
  minWidth?: DimensionValue
  minHeight?: DimensionValue
  maxWidth?: DimensionValue
  maxHeight?: DimensionValue

  margin?: Length | 'auto'
  marginTop?: Length | 'auto'
  marginRight?: Length | 'auto'
  marginBottom?: Length | 'auto'
  marginLeft?: Length | 'auto'
  marginStart?: Length | 'auto'
  marginEnd?: Length | 'auto'
  marginHorizontal?: Length | 'auto'
  marginVertical?: Length | 'auto'

  padding?: Length
  paddingTop?: Length
  paddingRight?: Length
  paddingBottom?: Length
  paddingLeft?: Length
  paddingStart?: Length
  paddingEnd?: Length
  paddingHorizontal?: Length
  paddingVertical?: Length

  position?: 'absolute' | 'relative'

  top?: Length
  right?: Length
  bottom?: Length
  left?: Length
  start?: Length
  end?: Length

  /* FlexBox */
  flex?: number
  flexGrow?: number
  flexShrink?: number
  flexBasis?: Length | 'auto'

  flexDirection?: 'row' | 'row-reverse' | 'column' | 'column-reverse'
  flexWrap?: 'nowrap' | 'wrap' | 'wrap-reverse'

  justifyContent?:
    | 'flex-start'
    | 'flex-end'
    | 'center'
    | 'space-between'
    | 'space-around'
    | 'space-evenly'

  alignItems?: 'flex-start' | 'flex-end' | 'center' | 'stretch' | 'baseline'
  alignSelf?: 'auto' | 'flex-start' | 'flex-end' | 'center' | 'stretch' | 'baseline'
  alignContent?:
    | 'flex-start'
    | 'flex-end'
    | 'center'
    | 'stretch'
    | 'space-between'
    | 'space-around'
    | 'space-evenly'

  /* Gaps (Newer support) */
  gap?: number
  rowGap?: number
  columnGap?: number

  /* Box model */
  boxSizing?: 'border-box' | 'content-box' // Added in 0.77+

  overflow?: 'visible' | 'hidden' | 'scroll'
  display?: 'flex' | 'none' | 'contents' // 'contents' added ~0.77
}

/* ------------------------------------------------------------
 * Transform Styles
 * ------------------------------------------------------------ */
export interface TransformsStyle {
  transform?: Array<
    | { perspective: number }
    | { rotate: `${number}deg` | `${number}rad` }
    | { rotateX: `${number}deg` | `${number}rad` }
    | { rotateY: `${number}deg` | `${number}rad` }
    | { rotateZ: `${number}deg` | `${number}rad` }
    | { scale: number }
    | { scaleX: number }
    | { scaleY: number }
    | { translateX: Length }
    | { translateY: Length }
    | { skewX: `${number}deg` }
    | { skewY: `${number}deg` }
  >
  transformOrigin?:
    | 'center'
    | 'top'
    | 'bottom'
    | 'left'
    | 'right'
    | `${Length} ${Length}`
    | `${Length} ${Length} ${Length}`
}

/* ------------------------------------------------------------
 * Shadow & Filter (New Arch features — 0.76+)
 * ------------------------------------------------------------ */
export type BoxShadowValue =
  | string // CSS-like: "10px 5px 15px rgba(0,0,0,0.3)" or "inset 2px 2px 4px red"
  | Array<{
      offsetX: Length
      offsetY: Length
      blurRadius?: Length
      spreadDistance?: Length
      color?: Color
      inset?: boolean
    }>

export type FilterFunction =
  | { brightness: number | `${number}%` }
  | { contrast: number | `${number}%` }
  | { grayscale: number | `${number}%` }
  | { hueRotate: `${number}deg` }
  | { invert: number | `${number}%` }
  | { opacity: number | `${number}%` }
  | { saturate: number | `${number}%` }
  | { sepia: number | `${number}%` }
  | { blur: Length }
  | {
      dropShadow:
        | {
            offsetX: Length
            offsetY: Length
            blurRadius?: Length
            color?: Color
          }
        | string
    }

export type FilterValue = string | FilterFunction[]

/* ------------------------------------------------------------
 * CORE VIEW STYLE
 * ------------------------------------------------------------ */
export interface ViewStyle extends FlexStyle, TransformsStyle {
  /* Visual */
  backgroundColor?: Color
  opacity?: number
  zIndex?: number
  pointerEvents?: 'auto' | 'none' | 'box-none' | 'box-only'

  backfaceVisibility?: 'visible' | 'hidden'

  /* Borders */
  borderWidth?: number
  borderTopWidth?: number
  borderRightWidth?: number
  borderBottomWidth?: number
  borderLeftWidth?: number
  borderStartWidth?: number
  borderEndWidth?: number

  borderColor?: Color
  borderTopColor?: Color
  borderRightColor?: Color
  borderBottomColor?: Color
  borderLeftColor?: Color
  borderStartColor?: Color
  borderEndColor?: Color

  borderStyle?: 'solid' | 'dotted' | 'dashed'

  borderRadius?: Length
  borderTopLeftRadius?: Length
  borderTopRightRadius?: Length
  borderBottomLeftRadius?: Length
  borderBottomRightRadius?: Length
  borderStartStartRadius?: Length // logical
  borderStartEndRadius?: Length
  borderEndStartRadius?: Length
  borderEndEndRadius?: Length

  /* New Arch shadows & effects (0.76+) */
  boxShadow?: BoxShadowValue // Preferred modern cross-platform shadow

  filter?: FilterValue // New Arch only

  mixBlendMode?:
    | 'normal'
    | 'multiply'
    | 'screen'
    | 'overlay'
    | 'darken'
    | 'lighten'
    | 'color-dodge'
    | 'color-burn'
    | 'hard-light'
    | 'soft-light'
    | 'difference'
    | 'exclusion'
    | 'hue'
    | 'saturation'
    | 'color'
    | 'luminosity' // Added ~0.77, New Arch

  /* Outline (0.77+) */
  outlineColor?: Color
  outlineWidth?: Length
  outlineStyle?: 'solid' | 'dotted' | 'dashed'
  outlineOffset?: Length

  /* Legacy iOS/Android shadows (still supported) */
  shadowColor?: Color
  shadowOffset?: { width: number; height: number }
  shadowOpacity?: number
  shadowRadius?: number
  elevation?: number // Android only
}

/* ------------------------------------------------------------
 * CORE TEXT STYLE (extends ViewStyle)
 * ------------------------------------------------------------ */
export interface TextStyle extends ViewStyle {
  color?: Color
  fontFamily?: string
  fontSize?: number
  fontStyle?: 'normal' | 'italic'
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
    | number

  fontVariant?: Array<
    'small-caps' | 'oldstyle-nums' | 'lining-nums' | 'tabular-nums' | 'proportional-nums'
  >

  letterSpacing?: number
  lineHeight?: number | `${number}%`
  textAlign?: 'auto' | 'left' | 'right' | 'center' | 'justify'
  textAlignVertical?: 'auto' | 'top' | 'bottom' | 'center' // Android

  textTransform?: 'none' | 'uppercase' | 'lowercase' | 'capitalize'

  textDecorationLine?: 'none' | 'underline' | 'line-through' | 'underline line-through'
  textDecorationColor?: Color
  textDecorationStyle?: 'solid' | 'double' | 'dotted' | 'dashed'

  textShadowColor?: Color
  textShadowOffset?: { width: number; height: number }
  textShadowRadius?: number

  /* Selection */
  userSelect?: 'auto' | 'text' | 'none' | 'contain' | 'all' // limited platform support

  /* Writing direction */
  writingDirection?: 'auto' | 'ltr' | 'rtl'
}

/* ------------------------------------------------------------
 * CORE IMAGE STYLE (extends ViewStyle)
 * ------------------------------------------------------------ */
export interface ImageStyle extends ViewStyle {
  resizeMode?: 'cover' | 'contain' | 'stretch' | 'repeat' | 'center'
  tintColor?: Color

  /* Modern object-fit equivalent (partial support) */
  objectFit?: 'cover' | 'contain' | 'fill' | 'scale-down'

  /* Overlay / blend */
  overlayColor?: Color // iOS
}

/* ------------------------------------------------------------
 * Combined / Utility Types
 * ------------------------------------------------------------ */
export type Styles = ViewStyle | TextStyle | ImageStyle
