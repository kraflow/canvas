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

  // 1. Initialize CanvasKit
  const ck = await loadCanvasKit()

  // 2. Initialize Fonts
  const manifest = createFontManifest({
    families: {
      Inter: {
        weights: [400, 700],
        variants: {
          '400': { url: 'https://cdn.jsdelivr.net/fontsource/fonts/inter@latest/latin-400-normal.woff2', priority: 'eager' },
          '700': { url: 'https://cdn.jsdelivr.net/fontsource/fonts/inter@latest/latin-700-normal.woff2', priority: 'lazy' },
        },
        unicodeRanges: ['U+0000-00FF'],
      }
    },
    fallbackChain: ['Inter'],
    eagerLoad: ['Inter'],
  })
  fonts = await createFontSystem(ck, manifest)

  // 3. Prepare Text (Cached)
  // Float32Array expectation in our paragraph builder (0-1 range)
  const textColor = new Float32Array([1, 1, 1, 1])
  const subtitleColor = new Float32Array([0.7, 0.7, 0.8, 1])

  cachedParagraph = await fonts.makeParagraph(
    "Kraflow Canvas Engine",
    "Inter", 
    { 
      fontSize: 64, 
      color: textColor,
      fontWeight: 700,
      letterSpacing: -1
    }, 
    1000
  )

  subtitle = await fonts.makeParagraph(
    "High-performance WebGL rendering. Real-time dynamic typography.",
    "Inter",
    {
      fontSize: 24,
      color: subtitleColor,
      fontWeight: 400
    },
    800
  )

  // 4. Initialize Renderer
  renderer = createRenderer({
    canvasElement: canvasRef.value,
    pixelRatio: window.devicePixelRatio,
    onDraw: (canvas, ck) => {
      const time = performance.now() * 0.001
      
      canvas.clear(ck.Color(12, 12, 14, 255)) // Deep dark background

      // Draw floating gradient orbs
      const paint = new ck.Paint()
      paint.setAntiAlias(true)
      
      // Orb 1
      paint.setColor(ck.Color(100 + Math.sin(time) * 100, 50, 255, 127))
      canvas.drawCircle(400 + Math.cos(time * 0.8) * 100, 400 + Math.sin(time * 1.2) * 50, 300, paint)
      
      // Orb 2
      paint.setColor(ck.Color(50, 200 + Math.cos(time) * 55, 150, 76))
      canvas.drawCircle(800 + Math.sin(time * 0.5) * 150, 300 + Math.cos(time * 0.9) * 100, 350, paint)

      paint.delete()

      // Draw Typography
      if (cachedParagraph) {
        canvas.drawParagraph(cachedParagraph, 100, 200)
      }
      if (subtitle) {
        canvas.drawParagraph(subtitle, 104, 290)
      }
    }
  })

  await renderer.init()
  renderer.setAnimating(true)

  // 5. Handle Resize gracefully
  window.addEventListener('resize', handleResize)
  // Initial size burst trick to catch container bounds correctly on mount
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
  <div class="app-container">
    <!-- Premium Navbar -->
    <nav class="navbar">
      <div class="logo">
        <span class="logo-icon"></span>
        <span class="logo-text">Kraflow Playground</span>
      </div>
      <div class="nav-links">
        <button class="action-btn">Deploy</button>
      </div>
    </nav>

    <!-- Main Canvas Area -->
    <main class="canvas-container">
      <canvas ref="canvasRef"></canvas>
    </main>
  </div>
</template>

<style scoped>
/* Base Layout */
.app-container {
  width: 100vw;
  height: 100vh;
  display: flex;
  flex-direction: column;
  background-color: #0c0c0e;
  color: #fff;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  overflow: hidden;
}

/* Navbar Glassmorphism */
.navbar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 32px;
  background: rgba(18, 18, 20, 0.6);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  z-index: 100;
}

/* Brand/Logo Styling */
.logo {
  display: flex;
  align-items: center;
  gap: 12px;
}

.logo-icon {
  width: 24px;
  height: 24px;
  border-radius: 6px;
  background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
  box-shadow: 0 0 16px rgba(79, 172, 254, 0.4);
}

.logo-text {
  font-size: 1.1rem;
  font-weight: 600;
  letter-spacing: -0.02em;
  background: linear-gradient(to right, #fff, #a1a1aa);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}

/* Navbar Action */
.action-btn {
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #fff;
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 0.9rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.action-btn:hover {
  background: rgba(255, 255, 255, 0.15);
  border-color: rgba(255, 255, 255, 0.2);
  transform: translateY(-1px);
}

/* Canvas Layout */
.canvas-container {
  flex: 1;
  width: 100%;
  height: 100%;
  position: relative;
  /* Navbar pushed content downwards */
  margin-top: 64px;
  background: #0c0c0e;
}

canvas {
  display: block;
  width: 100%;
  height: 100%;
  outline: none;
}
</style>
