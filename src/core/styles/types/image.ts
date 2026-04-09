import type { Color } from 'canvaskit-wasm'
import type { ViewStyle } from './view'

export interface ImageStyle extends ViewStyle {
  // ── Resize behavior ─────────────────────────────────────────────────────────
  /**
   * Default: 'cover'
   */
  resizeMode?: 'cover' | 'contain' | 'stretch' | 'repeat' | 'center'

  /**
   * CSS-spec equivalent of resizeMode (preferred for New Architecture).
   * Default: 'cover'
   */
  objectFit?: 'cover' | 'contain' | 'fill' | 'scale-down'

  // ── Tint ────────────────────────────────────────────────────────────────────
  /** Replaces all non-transparent pixels with this color */
  tintColor?: Color

  // ── Borders (narrowed subset from ViewStyle; Image accepts only these) ───────
  borderRadius?: number | string
  borderTopLeftRadius?: number | string
  borderTopRightRadius?: number | string
  borderBottomLeftRadius?: number | string
  borderBottomRightRadius?: number | string
  borderColor?: Color
  borderWidth?: number

  // ── Overflow ────────────────────────────────────────────────────────────────
  /** Default: 'visible' */
  overflow?: 'visible' | 'hidden'
}
