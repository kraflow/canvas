<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { loadCanvasKit, createRenderer, type Renderer } from '@/core/render'
import { createFontSystem, createFontManifest, type FontSystem } from '@/core/fonts'
import { resolveViewStyle, resolveTextStyle, resolveImageStyle } from '@/core/styles'

const canvasRef = ref<HTMLCanvasElement | null>(null)
let renderer: Renderer | null = null
let fonts: FontSystem | null = null

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

  // 1. Resolve Styles Once
  const rBoxStyle = resolveViewStyle(ck, {
    backgroundColor: 'rgba(50, 150, 255, 0.2)',
    borderRadius: 24,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.8)',
  })

  const rTitleStyle = resolveTextStyle(ck, {
    fontSize: 32,
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontFamily: 'Inter',
    backgroundColor: '#FF3366',
    borderRadius: 12,
    borderWidth: 2,
  })

  const rSubtitleStyle = resolveTextStyle(ck, {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.7)',
    lineHeight: 1.5,
    fontFamily: 'Inter',
  })

  const rImgStyle = resolveImageStyle(ck, {
    backgroundColor: '#333333',
    opacity: 0.85,
  })

  fonts = await createFontSystem(ck, manifest)

  renderer = createRenderer({
    canvasElement: canvasRef.value,
    pixelRatio: window.devicePixelRatio,
    fonts,
    onDraw: (canvas, ck) => {
      canvas.clear(ck.Color(20, 20, 25, 255))

      const time = performance.now() / 1000
      const yOffset = Math.sin(time) * 10

      // 1. Draw a functional View
      renderer!.view({ x: 100, y: 150 + yOffset, w: 300, h: 400 }, rBoxStyle)

      // 2. Draw Text organically over the box
      renderer!.text(
        {
          x: 120,
          y: 180 + yOffset,
          w: 280,
          h: 100,
        },
        rTitleStyle,
        'Functional API',
      )

      renderer!.text(
        {
          x: 120,
          y: 230 + yOffset,
          w: 260,
          h: 200,
        },
        rSubtitleStyle,
        'This entire layout is rendered strictly via the stateless weakmap wrappers without class memory leaks.',
      )

      // 3. Draw Image
      renderer!.image(
        {
          x: 500,
          y: 150,
          w: 300,
          h: 300,
        },
        rImgStyle,
        'https://picsum.photos/300/300?random=1',
      )
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
