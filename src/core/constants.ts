/**
 * Centralized core configuration for visual styles, dimensions, and theme colors.
 */

export const IS_DEV = import.meta.env.DEV

/** Core colors used throughout the canvas for highlights, selections, and defaults. */
export const CORE_COLORS = {
  INDIGO: {
    rgb: [99, 102, 241],
    float: new Float32Array([99 / 255, 102 / 255, 241 / 255, 1]),
  },
  RED: {
    rgb: [239, 68, 68],
    float: new Float32Array([239 / 255, 68 / 255, 68 / 255, 1]),
  },
  GRAY_400: {
    rgb: [161, 161, 170],
    float: new Float32Array([161 / 255, 161 / 161, 170 / 255, 1]),
  },
  WHITE: {
    rgb: [255, 255, 255],
    float: new Float32Array([1, 1, 1, 1]),
  },
  CANVAS_BG: {
    rgb: [12, 12, 14], // Matches .canvas-viewport CSS
    float: new Float32Array([0.047, 0.047, 0.055, 1]),
  },
  TRANSPARENT: {
    rgb: [0, 0, 0],
    float: new Float32Array([0, 0, 0, 0]),
  },
}

/** Configuration for drawing overlays like selections, hover states, and marquee. */
export const OVERLAY_CONFIG = {
  HOVER: {
    color: [...CORE_COLORS.INDIGO.rgb, 0.4],
    strokeWidth: 1.5,
    dash: [5, 5],
  },
  SELECTION: {
    color: [...CORE_COLORS.INDIGO.rgb, 1],
    strokeWidth: 2,
    offset: 1, // Visual offset from the node edge
  },
  MARQUEE: {
    fillColor: [...CORE_COLORS.INDIGO.rgb, 0.1],
    strokeColor: [...CORE_COLORS.INDIGO.rgb, 0.5],
    strokeWidth: 1,
  },
  PLACEMENT_GHOST: {
    validFill: [...CORE_COLORS.INDIGO.rgb, 0.1],
    validStroke: [...CORE_COLORS.INDIGO.rgb, 0.5],
    errorFill: [...CORE_COLORS.RED.rgb, 0.1],
    errorStroke: [...CORE_COLORS.RED.rgb, 0.5],
    strokeWidth: 2,
  },
  SCREEN_TITLE: {
    color: CORE_COLORS.GRAY_400.float,
    fontSize: 12,
    marginY: 8,
  },
}

/** Configuration for the viewport limits and sensitivity. */
export const VIEWPORT_CONFIG = {
  MIN_ZOOM: 0.01,
  MAX_ZOOM: 50.0,
  DEFAULT_ZOOM: 1.0,
  WHEEL_ZOOM_SENSITIVITY: 0.01,
}

/** Configuration for the infinite grid. */
export const GRID_CONFIG = {
  SHOW: true,
  COLOR_MINOR: [255, 255, 255, 0.05],
  COLOR_MAJOR: [255, 255, 255, 0.12],
  COLOR_AXIS: [99, 102, 241, 0.3], // Indigo-500
  SUB_GRID_THRESHOLD: 1.5, // Only show 10px grid above 150% zoom
  BASE_SIZE: 100,
  MAJOR_STEP: 5, // Major lines every 5 units
}

/** Default dimensions and spacing for the scene graph. */
export const SCENE_CONFIG = {
  SCREEN: {
    DEFAULT_WIDTH: 375,
    DEFAULT_HEIGHT: 812,
  },
  NODE: {
    DEFAULT_SPACING: 20,
    DEFAULT_PADDING: 16,
    DEFAULT_RADIUS: 8,
  },
}

/** Theme-based colors for different node types. */
export const NODE_THEMES = {
  VIEW: {
    bg: new Float32Array([0.388, 0.4, 0.945, 0.1]), // rgba(99, 102, 241, 0.1)
    border: new Float32Array([0.388, 0.4, 0.945, 0.8]), // rgba(99, 102, 241, 0.8)
  },
  TEXT: {
    color: CORE_COLORS.WHITE.float,
    border: new Float32Array([0.925, 0.282, 0.6, 0.8]), // rgba(236, 72, 153, 0.8)
  },
  IMAGE: {
    bg: new Float32Array([0.176, 0.831, 0.749, 0.1]), // rgba(45, 212, 191, 0.1)
    border: new Float32Array([0.176, 0.831, 0.749, 0.8]), // rgba(45, 212, 191, 0.8)
  },
}
