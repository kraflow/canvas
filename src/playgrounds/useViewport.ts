import { ref, onMounted, onBeforeUnmount, type Ref } from 'vue'

export interface ViewportOptions {
  /** Callback invoked when the viewport is resized. */
  onResize?: (width: number, height: number) => void
}

/**
 * useViewport provides camera logic (pan and zoom) for a canvas element.
 * It also handles the window resize event and notifies the caller via onResize.
 */
export function useViewport(
  canvasRef: Ref<HTMLCanvasElement | null>,
  options: ViewportOptions = {},
) {
  // 🔥 Camera state
  const camera = ref({
    x: 0,
    y: 0,
    zoom: 1,
  })

  // 🖱️ Interaction state
  let isDragging = false
  let lastX = 0
  let lastY = 0

  // 🖱️ Helpers
  function screenToWorld(x: number, y: number) {
    return {
      x: (x - camera.value.x) / camera.value.zoom,
      y: (y - camera.value.y) / camera.value.zoom,
    }
  }

  // 🖱️ Events
  function onMouseDown(e: MouseEvent) {
    isDragging = true
    lastX = e.clientX
    lastY = e.clientY
  }

  function onMouseMove(e: MouseEvent) {
    if (!isDragging) return

    const dx = e.clientX - lastX
    const dy = e.clientY - lastY

    camera.value.x += dx
    camera.value.y += dy

    lastX = e.clientX
    lastY = e.clientY
  }

  function onMouseUp() {
    isDragging = false
  }

  function onWheel(e: WheelEvent) {
    e.preventDefault()

    const scale = 1.1
    const mouseX = e.clientX
    const mouseY = e.clientY

    const before = screenToWorld(mouseX, mouseY)

    const newZoom = e.deltaY < 0 ? camera.value.zoom * scale : camera.value.zoom / scale

    camera.value.zoom = Math.max(0.1, Math.min(newZoom, 10))

    const after = screenToWorld(mouseX, mouseY)

    camera.value.x += (after.x - before.x) * camera.value.zoom
    camera.value.y += (after.y - before.y) * camera.value.zoom
  }

  // 📏 Resize
  function handleResize() {
    if (canvasRef.value) {
      const container = canvasRef.value.parentElement
      if (container) {
        const width = container.clientWidth
        const height = container.clientHeight
        options.onResize?.(width, height)
      }
    }
  }

  // 🚀 Setup and Cleanup
  onMounted(() => {
    const canvasEl = canvasRef.value
    if (!canvasEl) return

    canvasEl.addEventListener('mousedown', onMouseDown)
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    canvasEl.addEventListener('wheel', onWheel, { passive: false })

    window.addEventListener('resize', handleResize)
    handleResize()
  })

  onBeforeUnmount(() => {
    const canvasEl = canvasRef.value

    if (canvasEl) {
      canvasEl.removeEventListener('mousedown', onMouseDown)
      canvasEl.removeEventListener('wheel', onWheel)
    }

    window.removeEventListener('mousemove', onMouseMove)
    window.removeEventListener('mouseup', onMouseUp)
    window.removeEventListener('resize', handleResize)
  })

  return {
    camera,
    screenToWorld,
    handleResize,
  }
}
