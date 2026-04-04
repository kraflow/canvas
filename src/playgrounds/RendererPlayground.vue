<template>
  <div class="canvas-container">
    <canvas ref="canvasRef"></canvas>
  </div>
</template>

<script setup lang="ts">
import type { Canvas, CanvasKit, Paragraph } from 'canvaskit-wasm'
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { CanvasRenderer, loadCanvasKit } from '@/core/renderer'
import { createFontSystem, type FontSystem } from '@/core/fonts'
import { useViewport } from './useViewport'

const canvasRef = ref<HTMLCanvasElement | null>(null)
let renderer: CanvasRenderer | null = null
const { camera } = useViewport(canvasRef, {
  onResize: (w, h) => renderer?.resize(w, h),
})

let ck: CanvasKit | null = null

// 📝 Paragraph cache
let cachedParagraph: Paragraph | null = null
let subtitle: Paragraph | null = null

// 🔤 Font system
let fonts: FontSystem | null = null

/**
 * Performs the drawing for the playground.
 * @param canvas - The CanvasKit canvas.
 * @param ck - The CanvasKit instance.
 */
function draw(canvas: Canvas, ck: CanvasKit) {
  const time = performance.now() * 0.001

  canvas.clear(ck.Color(12, 12, 14, 255))

  canvas.save()

  // ✅ Apply camera transform (DPR handled by renderer)
  canvas.translate(camera.value.x, camera.value.y)
  canvas.scale(camera.value.zoom, camera.value.zoom)

  const paint = new ck.Paint()
  paint.setAntiAlias(true)

  paint.setColor(ck.Color(100 + Math.sin(time) * 100, 50, 255, 127))
  canvas.drawCircle(400 + Math.cos(time * 0.8) * 100, 400 + Math.sin(time * 1.2) * 50, 300, paint)

  paint.setColor(ck.Color(50, 200 + Math.cos(time) * 55, 150, 76))
  canvas.drawCircle(800 + Math.sin(time * 0.5) * 150, 300 + Math.cos(time * 0.9) * 100, 350, paint)

  paint.delete()

  canvas.restore()

  // 📝 Draw text (synchronous)
  if (cachedParagraph) {
    canvas.drawParagraph(cachedParagraph, 50, 100)
  }

  if (subtitle) {
    canvas.drawParagraph(subtitle, 50, 160)
  }
}

// 🚀 Mount
onMounted(async () => {
  try {
    if (!canvasRef.value) return

    ck = await loadCanvasKit()

    fonts = await createFontSystem(ck, {
      families: {
        Inter: {
          weights: [400, 700],
          variants: {
            '400': {
              url: 'https://cdn.jsdelivr.net/fontsource/fonts/inter@latest/latin-400-normal.ttf',
              priority: 'eager',
            },
            '700': {
              url: 'https://cdn.jsdelivr.net/fontsource/fonts/inter@latest/latin-700-normal.ttf',
              priority: 'lazy',
            },
          },
          unicodeRanges: ['U+0000-00FF'],
        },
      },
      fallbackChain: ['Inter'],
      eagerLoad: ['Inter'],
    })

    // 📝 Create text once
    const white = new Float32Array([1, 1, 1, 1])

    cachedParagraph = await fonts.makeParagraph(
      'CanvasKit Demo by @kraflow',
      'Inter',
      {
        fontSize: 48,
        color: white,
      },
      1000,
    )

    subtitle = await fonts.makeParagraph(
      'Zoom & Pan Enabled',
      'Inter',
      {
        fontSize: 20,
        color: white,
      },
      1000,
    )

    renderer = new CanvasRenderer({
      canvas: canvasRef.value,
      onDraw: draw,
    })

    await renderer.initialize()
    renderer.setAnimating(true)
  } catch (error) {
    console.error('[RendererPlayground] Initialization failed:', error)
  }
})

// 🧹 Cleanup
onBeforeUnmount(() => {
  renderer?.dispose()
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
