import type { StyleProp } from './index'

/**
 * Flattens a StyleProp (single object or array of objects) into a single style object.
 *
 * Implements React Native's shorthand expansion rules:
 * - Arrays are processed in order (later items override earlier ones)
 * - Shorthands (margin, padding, border, inset, gap) are expanded into their
 *   constituent longhand properties during the merge to ensure correct overrides.
 */
export function flattenStyle<T extends object>(style: StyleProp<T>): T {
  if (!style) return {} as T

  const result: Record<string, unknown> = {}

  function merge(s: StyleProp<T>) {
    if (!s) return
    if (Array.isArray(s)) {
      for (const item of s) {
        merge(item as StyleProp<T>)
      }
      return
    }

    const obj = s as Record<string, unknown>
    // Process each key and expand shorthands if needed
    for (const key in obj) {
      const val = obj[key]
      if (val === undefined || val === null) continue

      const expandFn = EXPANSION_MAP[key]
      if (expandFn) {
        Object.assign(result, expandFn(val))
      } else {
        result[key] = val
      }
    }
  }

  merge(style)
  return result as T
}

/**
 * Map of shorthand properties to their expansion functions.
 */
const EXPANSION_MAP: Record<string, (val: unknown) => Record<string, unknown>> = {
  // ── Margin ──────────────────────────────────────────────────────────────────
  margin: (v) => ({ marginTop: v, marginBottom: v, marginLeft: v, marginRight: v }),
  marginVertical: (v) => ({ marginTop: v, marginBottom: v }),
  marginHorizontal: (v) => ({ marginLeft: v, marginRight: v }),
  marginBlock: (v) => ({ marginBlockStart: v, marginBlockEnd: v }),
  marginInline: (v) => ({ marginInlineStart: v, marginInlineEnd: v }),

  // ── Padding ─────────────────────────────────────────────────────────────────
  padding: (v) => ({ paddingTop: v, paddingBottom: v, paddingLeft: v, paddingRight: v }),
  paddingVertical: (v) => ({ paddingTop: v, paddingBottom: v }),
  paddingHorizontal: (v) => ({ paddingLeft: v, paddingRight: v }),
  paddingBlock: (v) => ({ paddingBlockStart: v, paddingBlockEnd: v }),
  paddingInline: (v) => ({ paddingInlineStart: v, paddingInlineEnd: v }),

  // ── Position / Inset ────────────────────────────────────────────────────────
  inset: (v) => ({ top: v, bottom: v, left: v, right: v }),
  insetBlock: (v) => ({ top: v, bottom: v }),
  insetInline: (v) => ({ left: v, right: v }),

  // ── Border Widths ───────────────────────────────────────────────────────────
  borderWidth: (v) => ({
    borderTopWidth: v,
    borderBottomWidth: v,
    borderLeftWidth: v,
    borderRightWidth: v,
  }),

  // ── Border Colors ────────────────────────────────────────────────────────────
  borderColor: (v) => ({
    borderTopColor: v,
    borderBottomColor: v,
    borderLeftColor: v,
    borderRightColor: v,
  }),
  borderBlockColor: (v) => ({ borderBlockStartColor: v, borderBlockEndColor: v }),
  borderInlineColor: (v) => ({ borderInlineStartColor: v, borderInlineEndColor: v }),

  // ── Border Radii ─────────────────────────────────────────────────────────────
  borderRadius: (v) => ({
    borderTopLeftRadius: v,
    borderTopRightRadius: v,
    borderBottomLeftRadius: v,
    borderBottomRightRadius: v,
  }),

  // ── Gap ─────────────────────────────────────────────────────────────────────
  gap: (v) => ({ rowGap: v, columnGap: v }),
}
