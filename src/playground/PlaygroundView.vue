<template>
  <nav class="navbar">
    <h3>CanvasKit Demo 🚀</h3>
    <button @click="resizeCanvas">Resize</button>
  </nav>

  <div class="canvas-container">
    <canvas ref="canvasRef"></canvas>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { LayoutEngine, Renderer, StyleResolver, type LayoutRect } from '@/index'

const canvasRef = ref<HTMLCanvasElement | null>(null)
let renderer: Renderer | null = null

const DEBUG = false

async function render() {
  if (!renderer || DEBUG) return

  const styleResolver = new StyleResolver(renderer.getCk()!)
  const layoutEngine = new LayoutEngine(renderer.getPixelRatio())

  layoutEngine
    .createNode('root', {
      width: 390,
      height: 844,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
    })
    .createNode('text', {
      width: 200,
      height: 200,
    })
    .appendChild('root', 'text')
    .calculate(390, 844)

  const viewStyle = styleResolver.view(
    {
      backgroundColor: '#ffdfaf',
      opacity: 1,
      borderWidth: 10,
      borderColor: '#ff00ff',
    },
    layoutEngine.getLayout('root'),
  )

  const textStyle = styleResolver.text(
    {
      color: '#f0ff00',
      fontSize: 30,
      borderWidth: 1,
      borderColor: 'aqua',
    },
    layoutEngine.getLayout('text'),
  )

  const imageLayout: LayoutRect = { x: 400, y: 400, w: 200, h: 200 }
  const imageStyle = styleResolver.image(
    {
      resizeMode: 'cover',
    },
    imageLayout,
  )

  const im = await renderer!.loadImage('https://picsum.photos/200/200')!

  renderer.draw(
    (d) => {
      d.view(layoutEngine.getLayout('root'), viewStyle)
      d.text(layoutEngine.getLayout('text'), textStyle, 'Hello AK')

      d.image(imageLayout, imageStyle, im)
    },
    [0, 0, 0, 1],
  )
}

function resizeCanvas() {
  if (!renderer) return
  renderer.resize(window.innerWidth, window.innerHeight)
  render()
}

onMounted(async () => {
  if (!canvasRef.value) return

  renderer = new Renderer(canvasRef.value)
  await renderer.init(window.innerWidth, window.innerHeight)
  await renderer.loadFonts([
    { url: 'https://fonts.gstatic.com/s/roboto/v30/KFOmCnqEu92Fr1Mu4mxK.woff2' },
  ])

  render()

  window.addEventListener('resize', resizeCanvas)
})

onUnmounted(() => {
  window.removeEventListener('resize', resizeCanvas)
  renderer?.destroy()
})
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: sans-serif;
}

/* Navbar */
.navbar {
  display: none;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: #111;
  color: white;
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  width: 100%;
}

.navbar button {
  padding: 6px 12px;
  cursor: pointer;
}

/* Canvas container */
.canvas-container {
  min-height: 100vh;
  width: 100%;
  display: flex;
}
canvas {
  flex: 1;
}
</style>
