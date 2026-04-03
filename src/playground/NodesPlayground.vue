<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { loadCanvasKit, createRenderer, type Renderer } from '@/core/render'
import { createFontSystem, createFontManifest, type FontSystem } from '@/core/fonts'
import { view, text, image } from '@/core/draw'
import type { ViewStyle, TextStyle, ImageStyle } from '@/core/styles'

const canvasRef = ref<HTMLCanvasElement | null>(null)
let renderer: Renderer | null = null
let fonts: FontSystem | null = null

const boxStyle: ViewStyle = {
  backgroundColor: 'rgba(50, 150, 255, 0.2)',
  borderRadius: 24,
  borderWidth: 2,
  borderColor: 'rgba(255, 255, 255, 0.8)',
  shadowColor: '#00f2fe',
  shadowOpacity: 0.5,
  shadowRadius: 20,
  shadowOffset: { width: 0, height: 10 },
}

const tStyle: TextStyle = {
  fontSize: 32,
  color: '#FFFFFF',
  fontWeight: 'bold',
}

const subtitleStyle: TextStyle = {
  fontSize: 16,
  color: 'rgba(255, 255, 255, 0.7)',
  lineHeight: 1.5,
}

const imgStyle: ImageStyle = {
  backgroundColor: '#333333',
  opacity: 0.85,
}

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

  renderer = createRenderer({
    canvasElement: canvasRef.value,
    pixelRatio: window.devicePixelRatio,
    onDraw: (canvas, ck) => {
      canvas.clear(ck.Color(20, 20, 25, 255))

      const time = performance.now() / 1000

      // 1. Draw a functional View
      // Pulse vertical movement
      const yOffset = Math.sin(time) * 10
      view(ck, canvas, boxStyle, { x: 100, y: 150 + yOffset, width: 300, height: 400 })

      // 2. Draw Text organically over the box
      text(ck, canvas, fonts!, tStyle, 'Functional API', {
        x: 120,
        y: 180 + yOffset,
        width: 280,
        height: 100,
      })

      text(
        ck,
        canvas,
        fonts!,
        subtitleStyle,
        'This entire layout is rendered strictly via the stateless weakmap wrappers without class memory leaks.',
        { x: 120, y: 230 + yOffset, width: 260, height: 200 },
      )

      // 3. Draw Image
      // Image loads asynchronously and presents a dark box till complete
      image(ck, canvas, imgStyle, 'https://picsum.photos/300/300?random=1', {
        x: 500,
        y: 150,
        width: 300,
        height: 300,
      })
    },
  })

  await renderer.init()
  renderer.setAnimating(true)
  window.addEventListener('resize', handleResize)
  handleResize()
})

function handleResize() {
  if (renderer && canvasRef.value) {
    const parent = canvasRef.value.parentElement
    if (parent) renderer.resize(parent.clientWidth, parent.clientHeight)
  }
}

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
  if (fonts) fonts.dispose()
  if (renderer) renderer.dispose()
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
  background: #141419;
}
canvas {
  display: block;
  width: 100%;
  height: 100%;
  outline: none;
}
</style>
