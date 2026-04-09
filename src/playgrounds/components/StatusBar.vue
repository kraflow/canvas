<script setup lang="ts">
import type { Viewport } from '@/index'

defineProps<{
  cursorCoords: { x: number; y: number }
  showGrid: boolean
  zoomLevel: number
  screenCount: number
  nodeCount: number
  viewport: Viewport
}>()

const emit = defineEmits<{
  (e: 'toggleGrid'): void
  (e: 'zoomIn'): void
  (e: 'zoomOut'): void
}>()
</script>

<template>
  <footer class="status-bar">
    <div class="status-left">
      <div class="coords">X: {{ cursorCoords.x }} Y: {{ cursorCoords.y }}</div>
      <div class="separator"></div>
      <button class="grid-toggle" @click="emit('toggleGrid')" :class="{ active: showGrid }">
        Grid: {{ showGrid ? 'On' : 'Off' }}
      </button>
    </div>
    <div class="zoom-tools">
      <button @click="emit('zoomOut')">-</button>
      <span class="zoom-level">{{ zoomLevel }}%</span>
      <button @click="emit('zoomIn')">+</button>
    </div>
    <div class="layer-info">{{ screenCount }} Screens · {{ nodeCount }} Layers</div>
  </footer>
</template>

<style scoped>
.status-bar {
  height: 32px;
  background: #111113;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  font-size: 11px;
  color: #71717a;
  z-index: 100;
}
.status-left {
  display: flex;
  align-items: center;
  gap: 12px;
}
.separator {
  width: 1px;
  height: 12px;
  background: rgba(255, 255, 255, 0.1);
}
.grid-toggle {
  background: transparent;
  border: none;
  color: #71717a;
  cursor: pointer;
  font-size: 11px;
  padding: 2px 4px;
  border-radius: 4px;
}
.grid-toggle:hover {
  color: #fff;
}
.grid-toggle.active {
  color: #6366f1;
}
.zoom-tools {
  display: flex;
  align-items: center;
  gap: 8px;
}
.zoom-tools button {
  background: transparent;
  border: none;
  color: #a1a1aa;
  cursor: pointer;
  padding: 2px 8px;
}
.zoom-tools button:hover {
  color: #fff;
}
.icon {
  width: 20px;
  height: 20px;
  fill: currentColor;
}
</style>
