import type { CanvasKit, Color, InputColor } from 'canvaskit-wasm'

/**
 * Converts a Color (InputColor) to a CanvasKit Color (Float32Array [r,g,b,a] in 0–1 range).
 * Supports:
 *  - Float32Array  → returned as-is
 *  - number[]      → treated as [r,g,b,a] in 0–255 range
 *  - number (int)  → 0xAARRGGBB packed color int
 *  - string        → CSS color string parsed via CanvasKit
 */
export function toColor(ck: CanvasKit, value: InputColor | Color): Color {
  // Already a Float32Array (CanvasKit Color)
  if (value instanceof Float32Array) {
    return value as Color
  }

  // Array of numbers [r, g, b, a] in 0-255
  if (Array.isArray(value)) {
    const [r = 0, g = 0, b = 0, a = 1] = value
    return ck.Color(r / 255, g / 255, b / 255, a)
  }

  // Packed ARGB int
  if (typeof value === 'number') {
    const a = ((value >>> 24) & 0xff) / 255
    const r = ((value >>> 16) & 0xff) / 255
    const g = ((value >>> 8) & 0xff) / 255
    const b = (value & 0xff) / 255
    return ck.Color(r, g, b, a)
  }

  // Uint8Array (Uint8ClampedArray, etc.)
  if (value instanceof Uint8Array || value instanceof Uint8ClampedArray) {
    const [r = 0, g = 0, b = 0, a = 1] = value
    return ck.Color(r, g, b, a)
  }

  // CSS string
  if (typeof value === 'string') {
    // ck.parseColorString returns a Float32Array
    return ck.parseColorString(value)
  }

  // Fallback: transparent
  return ck.Color(0, 0, 0, 0)
}

/**
 * Converts a CanvasKit Color to [r, g, b, a] in 0–1 range for use in color matrices.
 */
export function colorToFloats(
  ck: CanvasKit,
  value: Color | InputColor,
): [number, number, number, number] {
  const c = toColor(ck, value)
  return [c[0]!, c[1]!, c[2]!, c[3]!]
}

/**
 * Converts individual r, g, b, a values to a CanvasKit Color.
 * @param r - Red value (0-255)
 * @param g - Green value (0-255)
 * @param b - Blue value (0-255)
 * @param a - Alpha value (0-1, default: 1)
 * @returns CanvasKit Color (Float32Array [r,g,b,a] in 0-1 range)
 */
export function arrayToColor(r: number, g: number, b: number, a = 1): Color {
  return new Float32Array([r / 255, g / 255, b / 255, a]) as Color
}
