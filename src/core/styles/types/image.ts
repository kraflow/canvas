import type { ColorValue, ViewStyle } from './view'

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
  tintColor?: ColorValue

  // ── Android corner overlay ───────────────────────────────────────────────────
  /**
   * Android only.
   * Fills the transparent corner space when using rounded borders.
   * Set to the same color as the image's background for best results.
   */
  overlayColor?: ColorValue

  // ── Borders (narrowed subset from ViewStyle; Image accepts only these) ───────
  borderRadius?: number | string
  borderTopLeftRadius?: number | string
  borderTopRightRadius?: number | string
  borderBottomLeftRadius?: number | string
  borderBottomRightRadius?: number | string
  borderColor?: ColorValue
  borderWidth?: number | string

  // ── Overflow ────────────────────────────────────────────────────────────────
  /** Default: 'visible' */
  overflow?: 'visible' | 'hidden'
}
