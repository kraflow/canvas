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
import { Renderer, StyleResolver, type LayoutRect } from '@/index'

const canvasRef = ref<HTMLCanvasElement | null>(null)
let renderer: Renderer | null = null

const DEBUG = false

async function render() {
  if (!renderer || DEBUG) return

  const styleResolver = new StyleResolver(renderer.getCk()!)

  const viewLayout: LayoutRect = { x: 0, y: 0, w: 200, h: 200 }
  const viewStyle = styleResolver.view(
    {
      backgroundColor: '#ff0000',
      opacity: 1,
      borderWidth: 10,
      borderColor: '#ff00ff',
      borderRadius: 100,
      boxShadow: [
        {
          color: '#00ff00',
          offsetX: 0,
          offsetY: 0,
          blurRadius: 20,
          inset: false,
          spreadDistance: 10,
        },
      ],
    },
    viewLayout,
  )

  const textLayout: LayoutRect = { x: 200, y: 200, w: 200, h: 200 }
  const textStyle = styleResolver.text(
    {
      color: '#f0ff00',
      fontSize: 30,
    },
    textLayout,
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
      d.view(viewLayout, viewStyle)
      d.text(textLayout, textStyle, 'Hello AK')

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
