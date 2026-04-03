import type { ViewStyle } from './view'

export interface ImageStyle extends ViewStyle {
  resizeMode?: 'cover' | 'contain' | 'stretch' | 'repeat' | 'center'
  tintColor?: string

  /* Modern object-fit equivalent (partial support) */
  objectFit?: 'cover' | 'contain' | 'fill' | 'scale-down'

  /* Overlay / blend */
  overlayColor?: string // iOS
}
