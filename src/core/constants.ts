/**
 * Centralized live configuration for visual styles, dimensions, and theme colors.
 * All values are getters - reading current value from the config object.
 * Use `configure()` to update values at any time.
 */

// =============================================================================
// Configuration Store (Mutable)
// =============================================================================

interface ConfigStore {
  // Core Colors
  COLOR_CANVAS_BG_FLOAT: Float32Array

  // Overlays
  OVERLAY_HOVER_COLOR: readonly number[]
  OVERLAY_HOVER_STROKE_WIDTH: number
  OVERLAY_HOVER_DASH: readonly number[]
  OVERLAY_SELECTION_COLOR: readonly number[]
  OVERLAY_SELECTION_STROKE_WIDTH: number
  OVERLAY_SELECTION_OFFSET: number
  OVERLAY_MARQUEE_FILL_COLOR: readonly number[]
  OVERLAY_MARQUEE_STROKE_COLOR: readonly number[]
  OVERLAY_MARQUEE_STROKE_WIDTH: number
  OVERLAY_GHOST_VALID_FILL: readonly number[]
  OVERLAY_GHOST_VALID_STROKE: readonly number[]
  OVERLAY_GHOST_ERROR_FILL: readonly number[]
  OVERLAY_GHOST_ERROR_STROKE: readonly number[]
  OVERLAY_GHOST_STROKE_WIDTH: number
  OVERLAY_SCREEN_TITLE_COLOR: Float32Array
  OVERLAY_SCREEN_TITLE_FONT_SIZE: number
  OVERLAY_SCREEN_TITLE_MARGIN_Y: number

  // Viewport
  VIEWPORT_MIN_ZOOM: number
  VIEWPORT_MAX_ZOOM: number
  VIEWPORT_DEFAULT_ZOOM: number
  VIEWPORT_WHEEL_ZOOM_SENSITIVITY: number

  // Grid
  GRID_SHOW: boolean
  GRID_COLOR_MINOR: readonly number[]
  GRID_COLOR_MAJOR: readonly number[]
  GRID_COLOR_AXIS: readonly number[]
  GRID_SUB_GRID_THRESHOLD: number
  GRID_BASE_SIZE: number
  GRID_SUB_GRID_DIVISION: number
  GRID_STROKE_WIDTH_MINOR: number
  GRID_STROKE_WIDTH_MAJOR: number
  GRID_STROKE_WIDTH_AXIS: number

  // Spatial Index
  SPATIAL_INDEX_CELL_SIZE: number

  // Text
  TEXT_DEFAULT_FONT_SIZE: number
  TEXT_DEFAULT_FONT_FAMILY: string
  TEXT_FALLBACK_FONT_FAMILY: string
  TEXT_MAX_PARAGRAPH_WIDTH: number
  TEXT_CACHE_MAX_ENTRIES: number
  TEXT_MEASURE_MAX_WIDTH: number
  TEXT_DEFAULT_SHADOW_ALPHA: number
  FONT_WEIGHT_NORMAL: number
  FONT_WEIGHT_MEDIUM: number
  FONT_WEIGHT_BOLD: number

  // Rendering
  PRECISION_BLUR_SIGMA: number
  PRECISION_STROKE_WIDTH: number

  // Border
  BORDER_DASH_LENGTH_MULTIPLIER: number
  BORDER_DASH_GAP_MULTIPLIER: number
  BORDER_DOT_SIZE_MULTIPLIER: number
  BORDER_DOT_GAP_MULTIPLIER: number

  // Luminance
  LUMINANCE_RED_WEIGHT: number
  LUMINANCE_GREEN_WEIGHT: number
  LUMINANCE_BLUE_WEIGHT: number
  LUMINANCE_HUE_RED_WEIGHT: number
  LUMINANCE_HUE_GREEN_WEIGHT: number
  LUMINANCE_HUE_BLUE_WEIGHT: number

  // Box Shadow
  BOX_SHADOW_DEFAULT_COLOR_FLOAT: Float32Array

  // Keyboard
  KEYBOARD_PAN_SHORTCUT: string

  // ID
  ID_START_COUNTER: number
}

// Default values factory (creates fresh instances to avoid mutations)
function createDefaults(): ConfigStore {
  return {
    // Core Colors
    COLOR_CANVAS_BG_FLOAT: new Float32Array([0.047, 0.047, 0.055, 1]), // rgba(0.047, 0.047, 0.055, 1)

    // Overlays
    OVERLAY_HOVER_COLOR: [99, 102, 241, 0.4], // rgba(99, 102, 241, 0.4)
    OVERLAY_HOVER_STROKE_WIDTH: 1.5,
    OVERLAY_HOVER_DASH: [5, 5],
    OVERLAY_SELECTION_COLOR: [99, 102, 241, 1], // rgba(99, 102, 241, 1)
    OVERLAY_SELECTION_STROKE_WIDTH: 2,
    OVERLAY_SELECTION_OFFSET: 1,
    OVERLAY_MARQUEE_FILL_COLOR: [99, 102, 241, 0.1], // rgba(99, 102, 241, 0.1)
    OVERLAY_MARQUEE_STROKE_COLOR: [99, 102, 241, 0.5], // rgba(99, 102, 241, 0.5)
    OVERLAY_MARQUEE_STROKE_WIDTH: 1,
    OVERLAY_GHOST_VALID_FILL: [99, 102, 241, 0.1], // rgba(99, 102, 241, 0.1)
    OVERLAY_GHOST_VALID_STROKE: [99, 102, 241, 0.5], // rgba(99, 102, 241, 0.5)
    OVERLAY_GHOST_ERROR_FILL: [239, 68, 68, 0.1], // rgba(239, 68, 68, 0.1)
    OVERLAY_GHOST_ERROR_STROKE: [239, 68, 68, 0.5], // rgba(239, 68, 68, 0.5)
    OVERLAY_GHOST_STROKE_WIDTH: 2,
    OVERLAY_SCREEN_TITLE_COLOR: new Float32Array([161 / 255, 161 / 255, 170 / 255, 1]), // rgba(161/255, 161/255, 170/255, 1)
    OVERLAY_SCREEN_TITLE_FONT_SIZE: 12,
    OVERLAY_SCREEN_TITLE_MARGIN_Y: 8,

    // Viewport
    VIEWPORT_MIN_ZOOM: 0.01,
    VIEWPORT_MAX_ZOOM: 50.0,
    VIEWPORT_DEFAULT_ZOOM: 1.0,
    VIEWPORT_WHEEL_ZOOM_SENSITIVITY: 0.01,

    // Grid
    GRID_SHOW: true,
    GRID_COLOR_MINOR: [255, 255, 255, 0.05], // rgba(255, 255, 255, 0.05)
    GRID_COLOR_MAJOR: [255, 255, 255, 0.12], // rgba(255, 255, 255, 0.12)
    GRID_COLOR_AXIS: [99, 102, 241, 0.3], // rgba(99, 102, 241, 0.3)
    GRID_SUB_GRID_THRESHOLD: 1.5,
    GRID_BASE_SIZE: 100,
    GRID_SUB_GRID_DIVISION: 10,
    GRID_STROKE_WIDTH_MINOR: 1,
    GRID_STROKE_WIDTH_MAJOR: 1.5,
    GRID_STROKE_WIDTH_AXIS: 2,

    // Spatial Index
    SPATIAL_INDEX_CELL_SIZE: 256,

    // Text
    TEXT_DEFAULT_FONT_SIZE: 14,
    TEXT_DEFAULT_FONT_FAMILY: 'Inter',
    TEXT_FALLBACK_FONT_FAMILY: 'system-ui',
    TEXT_MAX_PARAGRAPH_WIDTH: 1000,
    TEXT_CACHE_MAX_ENTRIES: 1000,
    TEXT_MEASURE_MAX_WIDTH: 1e9,
    TEXT_DEFAULT_SHADOW_ALPHA: 0.5,
    FONT_WEIGHT_NORMAL: 400,
    FONT_WEIGHT_MEDIUM: 500,
    FONT_WEIGHT_BOLD: 700,

    // Rendering
    PRECISION_BLUR_SIGMA: 100,
    PRECISION_STROKE_WIDTH: 10,

    // Border
    BORDER_DASH_LENGTH_MULTIPLIER: 3,
    BORDER_DASH_GAP_MULTIPLIER: 1.5,
    BORDER_DOT_SIZE_MULTIPLIER: 1,
    BORDER_DOT_GAP_MULTIPLIER: 2,

    // Luminance
    LUMINANCE_RED_WEIGHT: 0.2126,
    LUMINANCE_GREEN_WEIGHT: 0.7152,
    LUMINANCE_BLUE_WEIGHT: 0.0722,
    LUMINANCE_HUE_RED_WEIGHT: 0.213,
    LUMINANCE_HUE_GREEN_WEIGHT: 0.715,
    LUMINANCE_HUE_BLUE_WEIGHT: 0.072,

    // Box Shadow
    BOX_SHADOW_DEFAULT_COLOR_FLOAT: new Float32Array([0, 0, 0, 0.5]), // rgba(0, 0, 0, 0.5)

    // Keyboard
    KEYBOARD_PAN_SHORTCUT: 'Space',

    // ID
    ID_START_COUNTER: 1,
  }
}

// Internal mutable store
export const CONFIG: ConfigStore = createDefaults()

// =============================================================================
// Configuration API
// =============================================================================

export type ConfigOptions = Partial<ConfigStore>

/**
 * Configure the library with custom values.
 * Can be called at any time to update configuration.
 * Values are merged with existing config.
 */
export function configure(options: ConfigOptions): void {
  Object.assign(CONFIG, options)
}

/**
 * Reset all configuration to defaults.
 */
export function resetConfig(): void {
  const defaults = createDefaults()
  for (const key of Object.keys(CONFIG) as Array<keyof ConfigStore>) {
    ;(CONFIG as unknown as Record<string, unknown>)[key] = defaults[key] as unknown
  }
}

// =============================================================================
// Environment (Static - cannot be changed at runtime)
// =============================================================================

export const IS_DEV = __DEV__
