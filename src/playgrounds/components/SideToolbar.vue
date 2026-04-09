<script setup lang="ts">
const emit = defineEmits<{
  (e: 'addNode', type: 'view' | 'text' | 'image'): void
}>()
</script>

<template>
  <aside class="side-toolbar">
    <div class="node-tools">
      <button @click="emit('addNode', 'view')" title="Add View">
        <svg viewBox="0 0 24 24" class="icon">
          <path d="M3 3h18v18H3V3z" fill="none" stroke="currentColor" stroke-width="2" />
        </svg>
        <span class="label">View</span>
      </button>
      <button @click="emit('addNode', 'text')" title="Add Text">
        <svg viewBox="0 0 24 24" class="icon">
          <path d="M2.5 4v3h5v12h3V7h5V4h-13zm19 5h-9v3h3v7h3v-7h3V9z" />
        </svg>
        <span class="label">Text</span>
      </button>
      <button @click="emit('addNode', 'image')" title="Add Image">
        <svg viewBox="0 0 24 24" class="icon">
          <path
            d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"
          />
        </svg>
        <span class="label">Image</span>
      </button>
    </div>
  </aside>
</template>

<style scoped>
.side-toolbar {
  width: 56px;
  background: rgba(18, 18, 20, 0.6);
  backdrop-filter: blur(10px);
  border-right: 1px solid rgba(255, 255, 255, 0.05);
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 12px 0;
  z-index: 90;
}
.node-tools {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.node-tools button {
  background: transparent;
  border: none;
  width: 40px;
  height: 48px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #a1a1aa;
  cursor: pointer;
  border-radius: 8px;
  transition: all 0.2s;
  font-size: 10px;
}
.node-tools button:hover {
  background: rgba(255, 255, 255, 0.08);
  color: #fff;
}

.icon {
  width: 20px;
  height: 20px;
  fill: currentColor;
}
</style>
