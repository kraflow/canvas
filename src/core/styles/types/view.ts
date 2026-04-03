import type { Length, FlexStyle } from './flex'
import type { TransformStyle } from './transform'

export type BorderStyle = 'solid' | 'dotted' | 'dashed'
export type MixBlendMode =
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
  | 'luminosity'

export type BoxShadowValue =
  | string // CSS-like: "10px 5px 15px rgba(0,0,0,0.3)" or "inset 2px 2px 4px red"
  | Array<{
      offsetX: Length
      offsetY: Length
      blurRadius?: Length
      spreadDistance?: Length
      color?: string
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
            color?: string
          }
        | string
    }

export interface ViewStyle extends FlexStyle, TransformStyle {
  // Colors
  backgroundColor?: string

  // Opacity & Blend modes
  opacity?: number
  mixBlendMode?: MixBlendMode

  // New CSS additions (RN 0.74+)
  boxShadow?: BoxShadowValue
  filter?: string | FilterFunction[]

  // Shadows (Legacy / iOS)
  shadowColor?: string
  shadowOffset?: { width: number; height: number }
  shadowOpacity?: number
  shadowRadius?: number

  // Elevation (Android-like, mapped to shadow natively)
  elevation?: number

  // Borders
  borderColor?: string
  borderTopColor?: string
  borderRightColor?: string
  borderBottomColor?: string
  borderLeftColor?: string
  borderEndColor?: string
  borderStartColor?: string

  borderRadius?: number
  borderTopLeftRadius?: number
  borderTopRightRadius?: number
  borderBottomLeftRadius?: number
  borderBottomRightRadius?: number
  borderEndEndRadius?: number
  borderEndStartRadius?: number
  borderStartEndRadius?: number
  borderStartStartRadius?: number

  borderCurve?: 'circular' | 'continuous'
  borderStyle?: BorderStyle

  // Outlines
  outlineColor?: string
  outlineOffset?: number
  outlineStyle?: BorderStyle
  outlineWidth?: number

  // Interactions
  pointerEvents?: 'box-none' | 'none' | 'box-only' | 'auto'

  // React Native Specifics
  backfaceVisibility?: 'visible' | 'hidden'
}
