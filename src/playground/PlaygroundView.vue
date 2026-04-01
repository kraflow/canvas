<template>
  <nav class="navbar">
    <h3>CanvasKit Demo 🚀</h3>
    <div class="navbar-actions">
      <span v-if="status" class="status">{{ status }}</span>
      <button :disabled="!ready" @click="resizeCanvas">Resize</button>
    </div>
  </nav>

  <div class="canvas-container">
    <!-- Shown until the renderer is ready -->
    <div v-if="!ready" class="loader">
      <span>{{ status || 'Initialising…' }}</span>
    </div>
    <canvas ref="canvasRef" :class="{ hidden: !ready }" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { createScreen, h, Renderer, Scene, StyleResolver } from '@/index'

// ---------------------------------------------------------------------------
// Refs / state
// ---------------------------------------------------------------------------

const canvasRef = ref<HTMLCanvasElement | null>(null)
const ready = ref(false)
const status = ref('Initialising renderer…')

let renderer: Renderer | null = null
let scene: Scene | null = null
let styleResolver: StyleResolver | null = null

// Pre-fetched image cache: node src → CanvasKit Image object.
// We populate this before every draw so the synchronous draw callback
// can use images without needing to await inside it.
const imageCache = new Map<
  string,
  ReturnType<Renderer['loadImage']> extends Promise<infer T> ? T : never
>()

// ---------------------------------------------------------------------------
// Image pre-fetch
// Collect every unique src used by image nodes in the scene, load them all
// in parallel, and store the results in imageCache.
// ---------------------------------------------------------------------------

async function prefetchImages(): Promise<void> {
  if (!renderer || !scene) return

  const srcs = new Set<string>()

  scene.walkAll((node) => {
    if (node.type === 'image' && node.src) {
      srcs.add(node.src)
    }
  })

  await Promise.all(
    [...srcs].map(async (src) => {
      if (!imageCache.has(src)) {
        try {
          const img = await renderer!.loadImage(src)
          if (img) imageCache.set(src, img)
        } catch (err) {
          console.warn(`CanvasDemo: failed to load image "${src}"`, err)
        }
      }
    }),
  )
}

// ---------------------------------------------------------------------------
// Render
// Synchronous draw callback — all async work (image loading) is done before
// entering renderer.draw() so the draw callback itself stays synchronous.
// ---------------------------------------------------------------------------

async function render(): Promise<void> {
  if (!renderer || !scene) return

  await prefetchImages()

  renderer.draw((d) => {
    scene!.walk('login', (node) => {
      // Guard: skip nodes that have not been through calculateLayout yet.
      if (!node.rect || !node.resolvedStyle) return

      if (node.type === 'view') {
        d.view(node.rect, node.resolvedStyle)
      } else if (node.type === 'text') {
        d.text(node.rect, node.resolvedStyle, node.text)
      } else if (node.type === 'image') {
        const img = imageCache.get(node.src)
        if (img) {
          d.image(node.rect, node.resolvedStyle, img)
        }
      }
    })
  })
}

// ---------------------------------------------------------------------------
// Resize
// ---------------------------------------------------------------------------

function resizeCanvas(): void {
  if (!renderer || !scene) return
  renderer.resize(window.innerWidth, window.innerHeight)
  render()
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

onMounted(async () => {
  if (!canvasRef.value) return

  try {
    // 1. Boot the renderer
    renderer = new Renderer(canvasRef.value)
    await renderer.init(window.innerWidth, window.innerHeight)

    // 2. Load fonts
    status.value = 'Loading fonts…'
    await renderer.loadFonts([
      { url: 'https://fonts.gstatic.com/s/roboto/v30/KFOmCnqEu92Fr1Mu4mxK.woff2' },
    ])

    // 3. Build scene
    status.value = 'Building scene…'
    styleResolver = new StyleResolver(renderer.getCk()!)
    scene = new Scene(styleResolver, renderer.getPixelRatio())

    const loginScreen = createScreen({
      id: 'login',
      label: 'Login',
      x: 0,
      y: 0,
      width: 390,
      height: 844,
      children: [
        h(
          'view',
          {
            flex: 1,
            flexDirection: 'column',
            alignItems: 'center',
            padding: 24,
            gap: 24,
          },
          [
            h('text', { fontSize: 28, fontWeight: 'bold' }, 'Welcome back'),
            h('text', { fontSize: 14, color: '#6B7280' }, 'Sign in to continue'),
            h(
              'image',
              { width: 120, height: 120, borderRadius: 60 },
              'https://picsum.photos/200/200',
            ),
            // Email field placeholder
            h(
              'view',
              {
                width: '100%',
                height: 48,
                borderRadius: 8,
                backgroundColor: '#F3F4F6',
                justifyContent: 'center',
                paddingHorizontal: 12,
              },
              [h('text', { fontSize: 14, color: '#9CA3AF' }, 'Email address')],
            ),
            // Password field placeholder
            h(
              'view',
              {
                width: '100%',
                height: 48,
                borderRadius: 8,
                backgroundColor: '#F3F4F6',
                justifyContent: 'center',
                paddingHorizontal: 12,
              },
              [h('text', { fontSize: 14, color: '#9CA3AF' }, 'Password')],
            ),
            // Sign-in button
            h(
              'view',
              {
                width: '100%',
                height: 48,
                borderRadius: 8,
                backgroundColor: '#6366F1',
                justifyContent: 'center',
                alignItems: 'center',
              },
              [h('text', { fontSize: 16, fontWeight: 'bold', color: '#FFFFFF' }, 'Sign in')],
            ),
          ],
        ),
      ],
    })

    scene.addScreen(loginScreen)
    scene.calculateLayout('login')

    // 4. First render
    status.value = 'Rendering…'
    await render()

    ready.value = true
    status.value = ''
  } catch (err) {
    console.error('CanvasDemo: init failed', err)
    status.value = `Error: ${err instanceof Error ? err.message : String(err)}`
  }

  window.addEventListener('resize', resizeCanvas)
})

onUnmounted(() => {
  window.removeEventListener('resize', resizeCanvas)
  // Delete cached images before destroying the renderer so CanvasKit doesn't
  // hold references to objects whose GPU resources are about to be freed.
  imageCache.clear()
  renderer?.destroy()
})
</script>

<style>
*,
*::before,
*::after {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: sans-serif;
  background: #0f0f0f;
}

/* ── Navbar ─────────────────────────────────────────────────────────────── */

.navbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: #111;
  color: white;
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 10;
  height: 52px;
  border-bottom: 1px solid #222;
}

.navbar h3 {
  font-size: 15px;
  font-weight: 600;
  letter-spacing: 0.01em;
}

.navbar-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.status {
  font-size: 12px;
  color: #9ca3af;
}

.navbar button {
  padding: 6px 14px;
  font-size: 13px;
  font-weight: 500;
  background: #6366f1;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: opacity 0.15s;
}

.navbar button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.navbar button:not(:disabled):hover {
  opacity: 0.85;
}

/* ── Canvas container ────────────────────────────────────────────────────── */

.canvas-container {
  min-height: 100vh;
  width: 100%;
  display: flex;
  padding-top: 52px; /* offset for fixed navbar */
}

canvas {
  flex: 1;
}

canvas.hidden {
  visibility: hidden;
}

/* ── Loader ──────────────────────────────────────────────────────────────── */

.loader {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #6b7280;
  font-size: 14px;
  letter-spacing: 0.02em;
}
</style>
