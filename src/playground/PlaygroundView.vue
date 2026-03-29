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
import { Renderer } from '@/index'

const canvasRef = ref<HTMLCanvasElement | null>(null)
let renderer: Renderer | null = null

function render() {
  if (!renderer) return

  renderer.draw((canvas) => {
    renderer!.drawText(canvas, 'Hello AK 🚀', 50, 100)
    renderer!.drawText(canvas, 'CanvasKit + Vue', 50, 160)
  })
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
  border: 1px solid #ccc;
  flex: 1;
}
</style>
