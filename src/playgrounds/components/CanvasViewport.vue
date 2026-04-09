<script setup lang="ts">
defineProps<{
  canvasCursor: string
  screenCount: number
  isPlacingScreen: boolean
  ghostOverlap: boolean
  ghostScreenPos: { x: number; y: number }
}>()

const emit = defineEmits<{
  (e: 'startPlacingScreen'): void
}>()

// Local ref for template binding - sync to parent ref
const localCanvasRef = defineModel<HTMLCanvasElement | null>()
</script>

<template>
  <section class="canvas-viewport" :style="{ cursor: canvasCursor }">
    <canvas ref="localCanvasRef" class="main-canvas"></canvas>
    <div class="canvas-grid-overlay" v-if="screenCount === 0 && !isPlacingScreen">
      <div class="empty-state">
        <h3>Start your creation</h3>
        <p>Add a screen or a node to begin designing</p>
        <button class="pixel-btn" @click="emit('startPlacingScreen')">Create First Screen</button>
      </div>
    </div>
    <div v-if="isPlacingScreen" class="placement-hint" :class="{ error: ghostOverlap }">
      {{ ghostOverlap ? 'Cannot overlap screens' : 'Click to place screen' }}
    </div>
  </section>
</template>

<style scoped>
.canvas-viewport {
  flex: 1;
  position: relative;
  background-color: #0c0c0e;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: crosshair;
}
.main-canvas {
  width: 100%;
  height: 100%;
  display: block;
}
.canvas-grid-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}
.empty-state {
  text-align: center;
  color: #71717a;
  background: rgba(12, 12, 14, 0.8);
  padding: 40px;
  border-radius: 20px;
  backdrop-filter: blur(10px);
}
.empty-state h3 {
  color: #fff;
  margin-bottom: 8px;
}
.pixel-btn {
  pointer-events: auto;
  margin-top: 16px;
  background: transparent;
  border: 1px solid #6366f1;
  color: #6366f1;
  padding: 8px 20px;
  border-radius: 20px;
  cursor: pointer;
  transition: all 0.2s;
}
.placement-hint {
  position: absolute;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(99, 102, 241, 0.9);
  color: white;
  padding: 8px 16px;
  border-radius: 99px;
  font-size: 13px;
  font-weight: 500;
  pointer-events: none;
  animation: fadeIn 0.3s ease;
}
.placement-hint.error {
  background: rgba(239, 68, 68, 0.9);
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translate(-50%, 10px);
  }
}
</style>
