import type { PointerInfo, ToolMode, UsePointerEventsOptions } from './types'

export function usePointerEvents(target: HTMLElement, options: UsePointerEventsOptions) {
  const { mode } = options

  // --- internal state ---

  // Active pointers (for pinch detection)
  const activePointers = new Map<number, { x: number; y: number }>()

  // temporary hand mode
  let spaceHeld = mode == 'hand'

  // Whether we are currently panning (pointer is down in hand mode)
  let isPanning = false
  let panPointerId = -1

  /* ----------------------------------------------------------
   * Helpers
   * ---------------------------------------------------------- */

  function makePointerInfo(e: PointerEvent): PointerInfo {
    return {
      pointerId: e.pointerId,
      screen: { x: e.clientX, y: e.clientY },
      shift: e.shiftKey,
      meta: e.metaKey || e.ctrlKey,
      alt: e.altKey,
      button: e.button as 0 | 1 | 2,
    }
  }

  function pinchDistance(): number | null {
    if (activePointers.size !== 2) return null
    const [a, b] = [...activePointers.values()]
    return Math.hypot(b!.x - a!.x, b!.y - a!.y)
  }

  function pinchMidpoint(): { x: number; y: number } | null {
    if (activePointers.size !== 2) return null
    const [a, b] = [...activePointers.values()]
    return { x: (a!.x + b!.x) / 2, y: (a!.y + b!.y) / 2 }
  }

  let lastPinchDistance: number | null = null

  /* ----------------------------------------------------------
   * pointerdown
   * ---------------------------------------------------------- */
  function onPointerDown(e: PointerEvent) {
    e.preventDefault()
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)

    activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY })

    // Pinch starting — reset last distance
    if (activePointers.size === 2) {
      lastPinchDistance = pinchDistance()
      isPanning = false
      return
    }

    if ((mode === 'hand' && spaceHeld) || e.button === 1) {
      // Middle mouse or hand mode = pan
      isPanning = true
      panPointerId = e.pointerId
    }

    options.onDown(makePointerInfo(e))
  }

  /* ----------------------------------------------------------
   * pointermove
   * ---------------------------------------------------------- */
  function onPointerMove(e: PointerEvent) {
    const prev = activePointers.get(e.pointerId)
    activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY })

    // --- two-finger pinch (touch or trackpad hardware gesture) ---
    if (activePointers.size === 2) {
      const dist = pinchDistance()
      const mid = pinchMidpoint()

      if (dist !== null && mid !== null && lastPinchDistance !== null) {
        const scaleDelta = dist / lastPinchDistance

        options.onZoom({
          screen: mid,
          delta: scaleDelta - 1, // positive = zoom in
          shift: e.shiftKey,
          meta: e.metaKey || e.ctrlKey,
          alt: e.altKey,
        })
      }

      lastPinchDistance = dist
      return
    }

    // --- single pointer pan (hand mode or middle mouse) ---
    if (isPanning && prev && e.pointerId === panPointerId) {
      options.onPan({
        screen: { x: e.clientX, y: e.clientY },
        deltaX: e.clientX - prev.x,
        deltaY: e.clientY - prev.y,
        pointerId: e.pointerId,
      })
    }
  }

  /* ----------------------------------------------------------
   * pointerup / pointercancel
   * ---------------------------------------------------------- */
  function onPointerUp(e: PointerEvent) {
    activePointers.delete(e.pointerId)
    lastPinchDistance = null

    if (e.pointerId === panPointerId) {
      isPanning = false
      panPointerId = -1
    }

    options.onUp(makePointerInfo(e))
  }

  /* ----------------------------------------------------------
   * wheel
   *
   * Key disambiguation:
   *   ctrlKey = true  → browser-synthesized pinch-to-zoom
   *                     (trackpad two-finger pinch OR cmd+scroll)
   *                     → treat as onZoom
   *   ctrlKey = false → trackpad two-finger scroll OR mouse wheel
   *                     → treat as onScroll
   *
   * Why ctrlKey works: browsers set ctrlKey=true on wheel events
   * that come from a trackpad pinch gesture or cmd/ctrl+wheel.
   * This is the only reliable cross-platform signal.
   * ---------------------------------------------------------- */
  function onWheel(e: WheelEvent) {
    e.preventDefault()

    if (e.ctrlKey) {
      // Pinch-to-zoom or cmd+wheel → zoom toward cursor
      // deltaY < 0 = zoom in, deltaY > 0 = zoom out
      // Normalize: small delta values from trackpad, large from mouse wheel
      const rawDelta = e.deltaY
      const normalized =
        e.deltaMode === WheelEvent.DOM_DELTA_LINE
          ? rawDelta * 8 // mouse wheel line mode → convert to pixels
          : e.deltaMode === WheelEvent.DOM_DELTA_PAGE
            ? rawDelta * 24
            : rawDelta // pixel mode (trackpad) — use directly

      // Convert to a scale factor: -0.01 per pixel feels good
      const delta = -normalized * 0.01

      options.onZoom({
        screen: { x: e.clientX, y: e.clientY },
        delta,
        shift: e.shiftKey,
        meta: e.metaKey || e.ctrlKey,
        alt: e.altKey,
      })
    } else {
      // Scroll (trackpad two-finger drag or mouse wheel)
      let deltaX = e.deltaX
      let deltaY = e.deltaY

      // Normalize line/page mode (mouse wheel) to pixels
      if (e.deltaMode === WheelEvent.DOM_DELTA_LINE) {
        deltaX *= 8
        deltaY *= 8
      } else if (e.deltaMode === WheelEvent.DOM_DELTA_PAGE) {
        deltaX *= 24
        deltaY *= 24
      }

      // shift+wheel on mouse = horizontal scroll (standard browser behavior)
      if (e.shiftKey && deltaX === 0) {
        deltaX = deltaY
        deltaY = 0
      }

      options.onScroll({
        screen: { x: e.clientX, y: e.clientY },
        deltaX,
        deltaY,
        shift: e.shiftKey,
        meta: e.metaKey,
        alt: e.altKey,
      })
    }
  }

  function setMode(m: ToolMode) {
    if (m == 'select' && isPanning) {
      isPanning = false
      panPointerId = -1
    }

    spaceHeld = m == 'hand'
  }

  /* ----------------------------------------------------------
   * Lifecycle
   * ---------------------------------------------------------- */
  function init() {
    // pointer events on the canvas element
    target.addEventListener('pointerdown', onPointerDown)
    target.addEventListener('pointermove', onPointerMove)
    target.addEventListener('pointerup', onPointerUp)
    target.addEventListener('pointercancel', onPointerUp)

    // wheel needs { passive: false } to call preventDefault()
    target.addEventListener('wheel', onWheel, { passive: false })
  }

  function destroy() {
    target.removeEventListener('pointerdown', onPointerDown)
    target.removeEventListener('pointermove', onPointerMove)
    target.removeEventListener('pointerup', onPointerUp)
    target.removeEventListener('pointercancel', onPointerUp)
    target.removeEventListener('wheel', onWheel)

    activePointers.clear()
  }

  return {
    init,
    destroy,
    setMode,
  }
}
