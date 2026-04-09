<script setup lang="ts">
defineProps<{
  interactionMode: 'edit' | 'move' | 'play'
  isPlacingScreen: boolean
}>()

const emit = defineEmits<{
  (e: 'setMode', mode: 'edit' | 'move' | 'play'): void
  (e: 'startPlacingScreen'): void
  (e: 'cancelPlacement'): void
}>()
</script>

<template>
  <header class="top-bar">
    <div class="project-info">
      <div class="project-icon">K</div>
      <span class="project-name">Kraflow Project</span>
    </div>

    <div class="main-tools">
      <div class="tool-group interaction-modes">
        <button
          @click="emit('setMode', 'edit')"
          :class="{ active: interactionMode === 'edit' }"
          title="Edit Mode (V)"
        >
          <svg viewBox="0 0 24 24" class="icon">
            <path d="M7 2l12 11.01L13 14.77 16 21l-2 1-3-6.23L7 22V2z" />
          </svg>
        </button>
        <button
          @click="emit('setMode', 'move')"
          :class="{ active: interactionMode === 'move' }"
          title="Move Tool (H)"
        >
          <svg viewBox="0 0 24 24" class="icon">
            <path
              d="M18 11h-5V6h5v5zm-6 0H7V6h5v5zm6 6h-5v-5h5v5zm-6 0H7v-5h5v5zM5 21V3h14v18H5z"
              fill="none"
            />
            <path
              d="M20.5 5V4.5a2.5 2.5 0 0 0-5 0V5h-1V4.5a2.5 2.5 0 0 0-5 0V5h-1V4.5a2.5 2.5 0 0 0-5 0V5h-1V4.5a2.5 2.5 0 0 0-5 0V11h1v10h18V11h1V5h-1zM9 4.5a1.5 1.5 0 0 1 3 0V5H9V4.5zM4 4.5a1.5 1.5 0 0 1 3 0V5H4V4.5zm11 15.5H5V4h18v12z"
            />
          </svg>
        </button>
        <button
          @click="emit('setMode', 'play')"
          :class="{ active: interactionMode === 'play' }"
          title="Play Mode (P)"
        >
          <svg viewBox="0 0 24 24" class="icon">
            <path d="M8 5v14l11-7z" />
          </svg>
        </button>
      </div>
      <div class="divider"></div>
      <div class="tool-group history-tools">
        <button title="Undo (Ctrl+Z)">
          <svg viewBox="0 0 24 24" class="icon">
            <path
              d="M12.5 8c-2.65 0-5.05.99-6.9 2.6L2 7v9h9l-3.62-3.62c1.39-1.16 3.16-1.88 5.12-1.88 3.54 0 6.55 2.31 7.6 5.5l2.37-.78C21.08 11.03 17.15 8 12.5 8z"
            />
          </svg>
        </button>
        <button title="Redo (Ctrl+Y)">
          <svg viewBox="0 0 24 24" class="icon">
            <path
              d="M18.4 10.6C16.55 8.99 14.15 8 11.5 8c-4.65 0-8.58 3.03-9.96 7.22L3.91 16c1.05-3.19 4.06-5.5 7.59-5.5 1.96 0 3.73.72 5.12 1.88L13 16h9V7l-3.6 3.6z"
            />
          </svg>
        </button>
      </div>
      <div class="divider"></div>
      <button
        class="primary-btn"
        @click="emit('startPlacingScreen')"
        :class="{ active: isPlacingScreen }"
      >
        <svg viewBox="0 0 24 24" class="icon">
          <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
        </svg>
        {{ isPlacingScreen ? 'Click to place...' : 'Add Screen' }}
      </button>
    </div>

    <div class="user-actions">
      <button v-if="isPlacingScreen" class="cancel-btn" @click="emit('cancelPlacement')">
        Cancel
      </button>
      <button class="share-btn">Share</button>
      <div class="avatar"></div>
    </div>
  </header>
</template>

<style scoped>
.top-bar {
  height: 56px;
  background: rgba(18, 18, 20, 0.8);
  backdrop-filter: blur(20px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  z-index: 100;
}

.project-info {
  display: flex;
  align-items: center;
  gap: 12px;
}
.project-icon {
  width: 32px;
  height: 32px;
  background: linear-gradient(135deg, #6366f1 0%, #a855f7 100%);
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 18px;
  box-shadow: 0 0 15px rgba(99, 102, 241, 0.3);
}
.project-name {
  font-weight: 500;
  font-size: 0.95rem;
  color: #fff;
}

.main-tools {
  display: flex;
  align-items: center;
  gap: 12px;
}
.tool-group {
  display: flex;
  gap: 4px;
}
.history-tools button {
  background: transparent;
  border: none;
  padding: 8px;
  color: #a1a1aa;
  cursor: pointer;
  border-radius: 6px;
  transition: all 0.2s;
}
.history-tools button:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.05);
  color: #fff;
}
.history-tools button:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.interaction-modes button.active {
  background: rgba(99, 102, 241, 0.2);
  color: #6366f1;
}

.divider {
  width: 1px;
  height: 24px;
  background: rgba(255, 255, 255, 0.1);
}

.primary-btn {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #fff;
  padding: 6px 14px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}
.primary-btn.active {
  background: rgba(99, 102, 241, 0.2);
  border-color: #6366f1;
  color: #6366f1;
}

.user-actions {
  display: flex;
  align-items: center;
  gap: 16px;
}
.cancel-btn {
  background: transparent;
  border: 1px solid #ef4444;
  color: #ef4444;
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
}
.share-btn {
  background: #6366f1;
  border: none;
  color: white;
  padding: 6px 16px;
  border-radius: 6px;
  font-weight: 500;
  cursor: pointer;
}
.avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: #2dd4bf;
  border: 2px solid rgba(255, 255, 255, 0.1);
}

.icon {
  width: 20px;
  height: 20px;
  fill: currentColor;
}
</style>
