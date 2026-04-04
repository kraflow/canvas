import type { InputColor } from 'canvaskit-wasm'
import type { FlexStyle } from './flex'

export type ColorValue = InputColor

// ─── Transform types ──────────────────────────────────────────────────────────

export type PerspectiveTransform = { perspective: number }
export type RotateTransform = { rotate: string } // e.g. '45deg'
export type RotateXTransform = { rotateX: string }
export type RotateYTransform = { rotateY: string }
export type RotateZTransform = { rotateZ: string }
export type ScaleTransform = { scale: number }
export type ScaleXTransform = { scaleX: number }
export type ScaleYTransform = { scaleY: number }
export type TranslateXTransform = { translateX: number }
export type TranslateYTransform = { translateY: number }
export type SkewXTransform = { skewX: string } // e.g. '30deg'
export type SkewYTransform = { skewY: string }
export type MatrixTransform = { matrix: number[] } // 6 or 16 element matrix

export type TransformFunction =
  | PerspectiveTransform
  | RotateTransform
  | RotateXTransform
  | RotateYTransform
  | RotateZTransform
  | ScaleTransform
  | ScaleXTransform
  | ScaleYTransform
  | TranslateXTransform
  | TranslateYTransform
  | SkewXTransform
  | SkewYTransform
  | MatrixTransform

// ─── Filter types (New Architecture, RN 0.84) ─────────────────────────────────

export type FilterBrightness = { brightness: number | string }
export type FilterOpacity = { opacity: number | string }
export type FilterBlur = { blur: number | string } // Android-only
export type FilterContrast = { contrast: number | string } // Android-only
export type FilterGrayscale = { grayscale: number | string } // Android-only
export type FilterHueRotate = { hueRotate: string } // Android-only, e.g. '90deg'
export type FilterInvert = { invert: number | string } // Android-only
export type FilterSepia = { sepia: number | string } // Android-only
export type FilterSaturate = { saturate: number | string } // Android-only
export type FilterDropShadow = { dropShadow: DropShadowValue | string } // Android 12+

export type FilterFunction =
  | FilterBrightness
  | FilterOpacity
  | FilterBlur
  | FilterContrast
  | FilterGrayscale
  | FilterHueRotate
  | FilterInvert
  | FilterSepia
  | FilterSaturate
  | FilterDropShadow

/**
 * Value for the `dropShadow` filter function.
 * See https://reactnative.dev/docs/dropshadowvalue
 */
export interface DropShadowValue {
  offsetX: number
  offsetY: number
  standardDeviation?: number
  color?: ColorValue
}

/**
 * Value for the `boxShadow` style prop.
 * See https://reactnative.dev/docs/boxshadowvalue
 */
export interface BoxShadowValue {
  offsetX: number
  offsetY: number
  blurRadius?: number
  spreadDistance?: number
  color?: ColorValue
  inset?: boolean
}

export interface ShadowStyle {
  /**
   * New Architecture only. Outset: Android 9+. Inset: Android 10+.
   * Accepts a BoxShadowValue array
   */
  boxShadow?: BoxShadowValue[]
}

export interface ViewStyle extends FlexStyle, ShadowStyle {
  // ── Background ──────────────────────────────────────────────────────────────
  backgroundColor?: ColorValue

  // ── Opacity & visibility ────────────────────────────────────────────────────
  opacity?: number
  backfaceVisibility?: 'visible' | 'hidden'

  // ── Overflow ────────────────────────────────────────────────────────────────
  overflow?: 'visible' | 'hidden' | 'scroll'

  // ── Border colors ───────────────────────────────────────────────────────────
  borderColor?: ColorValue
  borderTopColor?: ColorValue
  borderBottomColor?: ColorValue
  borderLeftColor?: ColorValue
  borderRightColor?: ColorValue

  // ── Border radii ────────────────────────────────────────────────────────────
  borderRadius?: number | string
  borderTopLeftRadius?: number | string
  borderTopRightRadius?: number | string
  borderBottomLeftRadius?: number | string
  borderBottomRightRadius?: number | string

  // ── Border style ────────────────────────────────────────────────────────────
  borderStyle?: 'solid' | 'dotted' | 'dashed'

  /**
   * iOS 13+ only. Controls corner smoothing.
   * Default: 'circular'
   */
  borderCurve?: 'circular' | 'continuous'

  // ── Transforms ──────────────────────────────────────────────────────────────
  transform?: TransformFunction[]
  transformOrigin?: string | (number | string)[]

  // ── Filter (New Architecture) ────────────────────────────────────────────────
  filter?: FilterFunction[]

  // ── Blend mode (New Architecture, Android 10+) ───────────────────────────────
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
    | 'luminosity'

  // ── Outline (New Architecture) ───────────────────────────────────────────────
  outlineColor?: ColorValue
  outlineOffset?: number
  outlineStyle?: 'solid' | 'dotted' | 'dashed'
  outlineWidth?: number

  // ── Pointer / cursor ────────────────────────────────────────────────────────
  /**
   * Controls touch-event targeting.
   * Default: 'auto'
   */
  pointerEvents?: 'auto' | 'box-none' | 'box-only' | 'none'

  /**
   * iOS 17+ only. 'pointer' enables hover effects for trackpad/stylus/visionOS gaze.
   * Default: 'auto'
   */
  cursor?: 'auto' | 'pointer'
}
