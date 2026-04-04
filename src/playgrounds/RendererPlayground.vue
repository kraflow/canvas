<template>
  <div class="canvas-container">
    <canvas ref="canvasRef"></canvas>
  </div>
</template>

<script setup lang="ts">
import type { Canvas, CanvasKit, FontMgr, Paragraph } from 'canvaskit-wasm'
import { ref, onMounted, onBeforeUnmount } from 'vue'
import {
  initializeCanvas,
  resize as resizeCanvas,
  dispose as disposeCanvas,
  setAnimating,
  loadCanvasKit,
} from '@/core/renderer'

const canvasRef = ref<HTMLCanvasElement | null>(null)

let fontMgr: FontMgr | null = null
let ck: CanvasKit | null = null

// 🔥 Camera state
const camera = {
  x: 0,
  y: 0,
  zoom: 1,
}

// 🖱️ Interaction state
let isDragging = false
let lastX = 0
let lastY = 0

// 📝 Paragraph cache
let cachedParagraph: Paragraph | null = null
let subtitle: Paragraph | null = null

// 🎨 Draw loop
function draw(canvas: Canvas, ck: CanvasKit) {
  const time = performance.now() * 0.001

  canvas.clear(ck.Color(12, 12, 14, 255))

  canvas.save()

  // ✅ Apply camera transform (DPR handled by renderer)
  canvas.translate(camera.x, camera.y)
  canvas.scale(camera.zoom, camera.zoom)

  const paint = new ck.Paint()
  paint.setAntiAlias(true)

  paint.setColor(ck.Color(100 + Math.sin(time) * 100, 50, 255, 127))
  canvas.drawCircle(400 + Math.cos(time * 0.8) * 100, 400 + Math.sin(time * 1.2) * 50, 300, paint)

  paint.setColor(ck.Color(50, 200 + Math.cos(time) * 55, 150, 76))
  canvas.drawCircle(800 + Math.sin(time * 0.5) * 150, 300 + Math.cos(time * 0.9) * 100, 350, paint)

  paint.delete()

  canvas.restore()

  if (cachedParagraph) canvas.drawParagraph(cachedParagraph, 100, 200)
  if (subtitle) canvas.drawParagraph(subtitle, 104, 290)
}

// 📝 Text helper
function createParagraph(
  ck: CanvasKit,
  text: string,
  fontSize: number,
  fontMgr: FontMgr,
): Paragraph {
  const textStyle = new ck.TextStyle({
    color: ck.Color(255, 255, 255, 255),
    fontSize,
    fontFamilies: ['Inter'],
  })

  const paragraphStyle = new ck.ParagraphStyle({
    textStyle, // ✅ REQUIRED
  })

  const builder = ck.ParagraphBuilder.Make(paragraphStyle, fontMgr)

  builder.pushStyle(textStyle)
  builder.addText(text)

  const paragraph = builder.build()
  paragraph.layout(1000)

  builder.delete() // 🔥 important (avoid leaks)

  return paragraph
}

// 🖱️ Helpers
function screenToWorld(x: number, y: number) {
  return {
    x: (x - camera.x) / camera.zoom,
    y: (y - camera.y) / camera.zoom,
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

  camera.x += dx
  camera.y += dy

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

  const newZoom = e.deltaY < 0 ? camera.zoom * scale : camera.zoom / scale

  camera.zoom = Math.max(0.1, Math.min(newZoom, 10))

  const after = screenToWorld(mouseX, mouseY)

  camera.x += (after.x - before.x) * camera.zoom
  camera.y += (after.y - before.y) * camera.zoom
}

// 📏 Resize
function handleResize() {
  if (canvasRef.value) {
    const container = canvasRef.value.parentElement
    if (container) {
      resizeCanvas(container.clientWidth, container.clientHeight)
    }
  }
}

// 🚀 Mount
onMounted(async () => {
  if (!canvasRef.value) return

  ck = await loadCanvasKit()

  const fontData = await fetch(
    'https://cdn.jsdelivr.net/fontsource/fonts/inter@latest/latin-400-normal.woff2',
  ).then((res) => res.arrayBuffer())

  fontMgr = ck.FontMgr.FromData(fontData)

  if (!fontMgr) {
    console.warn('FontMgr failed, falling back')
    return
  }

  // 📝 Create text once
  cachedParagraph = createParagraph(ck, 'CanvasKit Demo by @kraflow', 48, fontMgr)
  subtitle = createParagraph(ck, 'Zoom & Pan Enabled', 20, fontMgr)

  await initializeCanvas({
    canvas: canvasRef.value,
    onDraw: draw,
  })

  setAnimating(true)

  const canvasEl = canvasRef.value

  canvasEl.addEventListener('mousedown', onMouseDown)
  window.addEventListener('mousemove', onMouseMove)
  window.addEventListener('mouseup', onMouseUp)
  canvasEl.addEventListener('wheel', onWheel, { passive: false })

  window.addEventListener('resize', handleResize)
  handleResize()
})

// 🧹 Cleanup
onBeforeUnmount(() => {
  const canvasEl = canvasRef.value

  if (canvasEl) {
    canvasEl.removeEventListener('mousedown', onMouseDown)
    canvasEl.removeEventListener('wheel', onWheel)
  }

  window.removeEventListener('mousemove', onMouseMove)
  window.removeEventListener('mouseup', onMouseUp)
  window.removeEventListener('resize', handleResize)

  disposeCanvas()
})
</script>

<style scoped>
.canvas-container {
  width: 100%;
  height: 100%;
  position: relative;
  background: #0c0c0e;
  overflow: hidden;
}

canvas {
  display: block;
  width: 100%;
  height: 100%;
  cursor: grab;
}

canvas:active {
  cursor: grabbing;
}
</style>
