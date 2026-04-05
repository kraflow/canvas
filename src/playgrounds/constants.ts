/**
 * Default dimensions for a new screen.
 */
export const DEFAULT_SCREEN_WIDTH = 375
export const DEFAULT_SCREEN_HEIGHT = 812

/**
 * Default color for a new screen background.
 */
export const DEFAULT_SCREEN_BG = new Float32Array([0.118, 0.118, 0.118, 1]) // #1e1e1e

/**
 * Default padding/margin for new nodes.
 */
export const DEFAULT_NODE_SPACING = 20
export const DEFAULT_NODE_PADDING = 16
export const DEFAULT_NODE_RADIUS = 8

/**
 * Color palettes for different node types in the playground.
 */
export const COLORS = {
  VIEW: {
    bg: new Float32Array([0.388, 0.4, 0.945, 0.1]), // rgba(99, 102, 241, 0.1)
    border: new Float32Array([0.388, 0.4, 0.945, 0.8]), // rgba(99, 102, 241, 0.8)
  },
  TEXT: {
    bg: new Float32Array([0, 0, 0, 0]),
    border: new Float32Array([0.925, 0.282, 0.6, 0.8]), // rgba(236, 72, 153, 0.8)
    color: new Float32Array([1, 1, 1, 1]),
  },
  IMAGE: {
    bg: new Float32Array([0.176, 0.831, 0.749, 0.1]), // rgba(45, 212, 191, 0.1)
    border: new Float32Array([0.176, 0.831, 0.749, 0.8]), // rgba(45, 212, 191, 0.8)
  },
}

/**
 * Selection/Hover styles.
 */
export const INTERACTION_COLORS = {
  HOVER: new Float32Array([0.31, 0.275, 0.898, 1]), // #4F46E5
  SELECTION: new Float32Array([0.506, 0.549, 0.973, 1]), // #818CF8
  MARQUEE: new Float32Array([0.506, 0.549, 0.973, 0.2]), // rgba(129, 140, 248, 0.2)
}
