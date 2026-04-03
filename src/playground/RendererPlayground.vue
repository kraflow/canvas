<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import type { Paragraph } from 'canvaskit-wasm'
import { loadCanvasKit, createRenderer, type Renderer } from '@/core/render'
import { createFontSystem, createFontManifest, type FontSystem } from '@/core/fonts'

const canvasRef = ref<HTMLCanvasElement | null>(null)
let renderer: Renderer | null = null
let fonts: FontSystem | null = null
let cachedParagraph: Paragraph | null = null
let subtitle: Paragraph | null = null

onMounted(async () => {
  if (!canvasRef.value) return

  const ck = await loadCanvasKit()

  const manifest = createFontManifest({
    families: {
      Inter: {
        weights: [400, 700],
        variants: {
          '400': {
            url: 'https://cdn.jsdelivr.net/fontsource/fonts/inter@latest/latin-400-normal.woff2',
            priority: 'eager',
          },
          '700': {
            url: 'https://cdn.jsdelivr.net/fontsource/fonts/inter@latest/latin-700-normal.woff2',
            priority: 'lazy',
          },
        },
        unicodeRanges: ['U+0000-00FF'],
      },
    },
    fallbackChain: ['Inter'],
    eagerLoad: ['Inter'],
  })
  fonts = await createFontSystem(ck, manifest)

  const textColor = new Float32Array([1, 1, 1, 1])
  const subtitleColor = new Float32Array([0.7, 0.7, 0.8, 1])

  cachedParagraph = await fonts.makeParagraph(
    'Kraflow Canvas Engine',
    'Inter',
    {
      fontSize: 64,
      color: textColor,
      fontWeight: 700,
      letterSpacing: -1,
    },
    1000,
  )

  subtitle = await fonts.makeParagraph(
    'High-performance WebGL rendering. Real-time dynamic typography.',
    'Inter',
    {
      fontSize: 24,
      color: subtitleColor,
      fontWeight: 400,
    },
    800,
  )

  renderer = createRenderer({
    canvasElement: canvasRef.value,
    pixelRatio: window.devicePixelRatio,
    onDraw: (canvas, ck) => {
      const time = performance.now() * 0.001

      canvas.clear(ck.Color(12, 12, 14, 255))

      const paint = new ck.Paint()
      paint.setAntiAlias(true)

      paint.setColor(ck.Color(100 + Math.sin(time) * 100, 50, 255, 127))
      canvas.drawCircle(
        400 + Math.cos(time * 0.8) * 100,
        400 + Math.sin(time * 1.2) * 50,
        300,
        paint,
      )

      paint.setColor(ck.Color(50, 200 + Math.cos(time) * 55, 150, 76))
      canvas.drawCircle(
        800 + Math.sin(time * 0.5) * 150,
        300 + Math.cos(time * 0.9) * 100,
        350,
        paint,
      )

      paint.delete()

      if (cachedParagraph) canvas.drawParagraph(cachedParagraph, 100, 200)
      if (subtitle) canvas.drawParagraph(subtitle, 104, 290)
    },
  })

  await renderer.init()
  renderer.setAnimating(true)

  window.addEventListener('resize', handleResize)
  handleResize()
})

function handleResize() {
  if (renderer && canvasRef.value) {
    const container = canvasRef.value.parentElement
    if (container) {
      renderer.resize(container.clientWidth, container.clientHeight)
    }
  }
}

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
  if (cachedParagraph) cachedParagraph.delete()
  if (subtitle) subtitle.delete()
  if (renderer) renderer.dispose()
  if (fonts) fonts.dispose()
})
</script>

<template>
  <div class="canvas-container">
    <canvas ref="canvasRef"></canvas>
  </div>
</template>

<style scoped>
.canvas-container {
  width: 100%;
  height: 100%;
  position: relative;
  background: #0c0c0e;
}
canvas {
  display: block;
  width: 100%;
  height: 100%;
  outline: none;
}
</style>
