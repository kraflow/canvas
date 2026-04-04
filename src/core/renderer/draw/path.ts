import type { CanvasKit, InputRRect } from 'canvaskit-wasm'
import type { ViewStyle } from '@/core/styles'
import type { LayoutRect } from '../types'

/**
 * Resolved border radii for all four corners.
 * Each corner has (rx, ry) — for a basic radius they are equal.
 */
export interface ResolvedRadii {
  tlx: number
  tly: number
  trx: number
  try_: number
  brx: number
  bry: number
  blx: number
  bly: number
}

/**
 * Resolves border-radius values from ViewStyle.
 * Cascade: borderRadius → per-corner overrides.
 * String values like '50%' are resolved relative to width/height.
 */
export function resolveRadii(style: ViewStyle, w: number, h: number): ResolvedRadii {
  const base = resolveRadius(style.borderRadius, w, h)

  const tl = resolveRadius(style.borderTopLeftRadius, w, h) ?? base ?? 0
  const tr = resolveRadius(style.borderTopRightRadius, w, h) ?? base ?? 0
  const br = resolveRadius(style.borderBottomRightRadius, w, h) ?? base ?? 0
  const bl = resolveRadius(style.borderBottomLeftRadius, w, h) ?? base ?? 0

  return {
    tlx: tl,
    tly: tl,
    trx: tr,
    try_: tr,
    brx: br,
    bry: br,
    blx: bl,
    bly: bl,
  }
}

/**
 * Returns true if all radii are zero (no rounding needed).
 */
export function isSharpRect(radii: ResolvedRadii): boolean {
  return (
    radii.tlx === 0 &&
    radii.tly === 0 &&
    radii.trx === 0 &&
    radii.try_ === 0 &&
    radii.brx === 0 &&
    radii.bry === 0 &&
    radii.blx === 0 &&
    radii.bly === 0
  )
}

/**
 * Returns true if all corners have the same radius.
 */
export function isUniformRadius(radii: ResolvedRadii): boolean {
  return (
    radii.tlx === radii.trx &&
    radii.trx === radii.brx &&
    radii.brx === radii.blx &&
    radii.tly === radii.try_ &&
    radii.try_ === radii.bry &&
    radii.bry === radii.bly &&
    radii.tlx === radii.tly
  )
}

/**
 * Builds a CanvasKit RRect (InputRRect) from a LayoutRect and resolved radii.
 *
 * CanvasKit RRect format: [left, top, right, bottom, tlRx, tlRy, trRx, trRy, brRx, brRy, blRx, blRy]
 */
export function makeRRect(ck: CanvasKit, rect: LayoutRect, radii: ResolvedRadii): InputRRect {
  const { x, y, w, h } = rect

  // If uniform radius, use the simpler RRectXY helper
  if (isUniformRadius(radii)) {
    return ck.RRectXY(Float32Array.from([x, y, x + w, y + h]), radii.tlx, radii.tly)
  }

  // Per-corner: 12-element array
  return Float32Array.from([
    x,
    y,
    x + w,
    y + h,
    radii.tlx,
    radii.tly,
    radii.trx,
    radii.try_,
    radii.brx,
    radii.bry,
    radii.blx,
    radii.bly,
  ])
}

/**
 * Builds an RRect that is inset (shrunk) by the given amounts on each side.
 * Used for drawing the inner edge of borders.
 */
export function makeInsetRRect(
  ck: CanvasKit,
  rect: LayoutRect,
  radii: ResolvedRadii,
  top: number,
  right: number,
  bottom: number,
  left: number,
): InputRRect {
  const insetRect: LayoutRect = {
    x: rect.x + left,
    y: rect.y + top,
    w: Math.max(0, rect.w - left - right),
    h: Math.max(0, rect.h - top - bottom),
  }

  const insetRadii: ResolvedRadii = {
    tlx: Math.max(0, radii.tlx - left),
    tly: Math.max(0, radii.tly - top),
    trx: Math.max(0, radii.trx - right),
    try_: Math.max(0, radii.try_ - top),
    brx: Math.max(0, radii.brx - right),
    bry: Math.max(0, radii.bry - bottom),
    blx: Math.max(0, radii.blx - left),
    bly: Math.max(0, radii.bly - bottom),
  }

  return makeRRect(ck, insetRect, insetRadii)
}

/**
 * Builds an RRect that is outset (expanded) by the given amount on all sides.
 * Used for outlines and outset shadows.
 */
export function makeOutsetRRect(
  ck: CanvasKit,
  rect: LayoutRect,
  radii: ResolvedRadii,
  outset: number,
): InputRRect {
  const outsetRect: LayoutRect = {
    x: rect.x - outset,
    y: rect.y - outset,
    w: rect.w + outset * 2,
    h: rect.h + outset * 2,
  }

  const outsetRadii: ResolvedRadii = {
    tlx: radii.tlx + outset,
    tly: radii.tly + outset,
    trx: radii.trx + outset,
    try_: radii.try_ + outset,
    brx: radii.brx + outset,
    bry: radii.bry + outset,
    blx: radii.blx + outset,
    bly: radii.bly + outset,
  }

  return makeRRect(ck, outsetRect, outsetRadii)
}

// ─── Internals ────────────────────────────────────────────────────────────────

function resolveRadius(
  value: number | string | undefined,
  w: number,
  h: number,
): number | undefined {
  if (value === undefined || value === null) return undefined

  if (typeof value === 'number') return Math.max(0, value)

  // Percentage string e.g. '50%'
  if (typeof value === 'string' && value.endsWith('%')) {
    const pct = parseFloat(value) / 100
    if (Number.isNaN(pct)) return 0
    // Resolve percentage against the smaller dimension (common approach)
    return Math.max(0, pct * Math.min(w, h))
  }

  // Numeric string
  const num = parseFloat(value as string)
  return Number.isNaN(num) ? 0 : Math.max(0, num)
}
