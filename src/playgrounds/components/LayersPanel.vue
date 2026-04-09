<script setup lang="ts">
import type { SceneGraph, SceneNode } from '@/index'
import type { FlatNode } from '../composables/usePlaygroundState'

defineProps<{
  scene: SceneGraph | null
  selectedNodeIds: Set<string>
  getAllNodesFlat: (nodes: SceneNode[], depth?: number) => FlatNode[]
}>()

const emit = defineEmits<{
  (e: 'selectNode', id: string): void
}>()
</script>

<template>
  <aside class="layers-panel">
    <div class="panel-header">Layers</div>
    <div class="panel-content">
      <div v-for="screen in scene?.allScreens" :key="screen.id" class="screen-group">
        <div
          class="layer-item screen"
          :class="{ selected: selectedNodeIds.has(screen.id) }"
          @click="emit('selectNode', screen.id)"
        >
          <svg viewBox="0 0 24 24" class="icon" fill="#fff">
            <path
              d="M21 2H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h7l-2 3v1h8v-1l-2-3h7c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H3V4h18v12z"
            />
          </svg>
          <span class="name">{{ screen.name }}</span>
        </div>
        <div class="layer-list">
          <div
            v-for="node in getAllNodesFlat(screen.root.children)"
            :key="node.id"
            class="layer-item node"
            :class="{ selected: selectedNodeIds.has(node.id) }"
            :style="{ paddingLeft: node.depth * 16 + 12 + 'px' }"
            @click="emit('selectNode', node.id)"
          >
            <svg v-if="node.type === 'view'" viewBox="0 0 24 24" class="icon">
              <path d="M3 3h18v18H3V3zm16 16V5H5v14h14z" />
            </svg>
            <svg v-else-if="node.type === 'text'" viewBox="0 0 24 24" class="icon">
              <path d="M5 4v3h5.5v12h3V7H19V4H5z" />
            </svg>
            <svg v-else-if="node.type === 'image'" viewBox="0 0 24 24" class="icon">
              <path
                d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"
              />
            </svg>
            <span class="name">{{ node.type }}</span>
          </div>
        </div>
      </div>
    </div>
  </aside>
</template>

<style scoped>
.layers-panel {
  width: 240px;
  background: rgba(18, 18, 20, 0.8);
  border-right: 1px solid rgba(255, 255, 255, 0.05);
  display: flex;
  flex-direction: column;
  z-index: 90;
}
.panel-header {
  height: 40px;
  padding: 0 16px;
  display: flex;
  align-items: center;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #71717a;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}
.panel-content {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}
.layer-list {
  display: flex;
  flex-direction: column;
}
.layer-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 12px;
  color: #a1a1aa;
}
.layer-item:hover {
  background: rgba(255, 255, 255, 0.05);
  color: #fff;
}
.layer-item.selected {
  background: rgba(99, 102, 241, 0.15);
  color: #6366f1;
}
.layer-item.screen {
  font-weight: 500;
  color: #e1e1e4;
}
.layer-item.node {
  padding-left: 24px;
}
.layer-item .icon {
  width: 16px;
  height: 16px;
}
.screen-group {
  display: flex;
  flex-direction: column;
  margin-bottom: 8px;
}
</style>
