<script setup lang="ts">
import type { SceneGraph, SceneNode } from '@/index'

defineProps<{
  scene: SceneGraph | null
  selectedItem: {
    type: string
    data: SceneNode | { id: string; name?: string; x?: number; y?: number }
  } | null
}>()

const emit = defineEmits<{
  (
    e: 'updateStyle',
    selectedItem: { type: string; data: SceneNode } | null,
    key: string,
    value: number | undefined,
  ): void
  (e: 'updateContent', selectedItem: { type: string; data: SceneNode } | null, value: string): void
  (
    e: 'deleteSelected',
    selectedItem: { type: string; data: SceneNode | { id: string } } | null,
  ): void
}>()
</script>

<template>
  <aside class="properties-panel">
    <div class="panel-header">Properties</div>
    <div class="panel-content">
      <div v-if="selectedItem" class="props-editor">
        <div class="selection-badge">
          <span class="type-capsule">{{ (selectedItem.data as any).type || 'Screen' }}</span>
          <span class="id-text">{{ selectedItem.data.id }}</span>
        </div>

        <!-- Screen Specific -->
        <div v-if="selectedItem.type === 'screen'" class="prop-group">
          <label>Name</label>
          <input
            :value="(selectedItem.data as any).name"
            @input="(e: any) => ((selectedItem!.data as any).name = e.target.value)"
          />
          <div class="prop-row">
            <div class="prop-col">
              <label>X</label>
              <input
                type="number"
                :value="Math.round((selectedItem.data as any).x)"
                @change="
                  (e: any) =>
                    scene?.moveScreen(
                      selectedItem!.data.id,
                      Number(e.target.value),
                      (selectedItem!.data as any).y,
                    )
                "
              />
            </div>
            <div class="prop-col">
              <label>Y</label>
              <input
                type="number"
                :value="Math.round((selectedItem.data as any).y)"
                @change="
                  (e: any) =>
                    scene?.moveScreen(
                      selectedItem!.data.id,
                      (selectedItem!.data as any).x,
                      Number(e.target.value),
                    )
                "
              />
            </div>
          </div>
        </div>

        <!-- Node Common Layout -->
        <div v-if="selectedItem.type === 'node'" class="prop-group">
          <div class="group-title">Layout</div>
          <div class="prop-row">
            <div class="prop-col">
              <label>Width</label>
              <input
                type="number"
                :value="Math.round((selectedItem.data as any).style.width)"
                @change="
                  (e: any) => emit('updateStyle', selectedItem, 'width', Number(e.target.value))
                "
              />
            </div>
            <div class="prop-col">
              <label>Height</label>
              <input
                type="number"
                :value="Math.round((selectedItem.data as any).style.height)"
                @change="
                  (e: any) => emit('updateStyle', selectedItem, 'height', Number(e.target.value))
                "
              />
            </div>
          </div>
          <div class="prop-row">
            <div class="prop-col">
              <label>Radius</label>
              <input
                type="number"
                :value="(selectedItem.data as any).style.borderRadius"
                @change="
                  (e: any) =>
                    emit('updateStyle', selectedItem, 'borderRadius', Number(e.target.value))
                "
              />
            </div>
          </div>
        </div>

        <!-- Node Styling -->
        <div v-if="selectedItem.type === 'node'" class="prop-group">
          <div class="group-title">Styling</div>
          <label>Border Width</label>
          <input
            type="number"
            :value="(selectedItem.data as any).style.borderWidth"
            @change="
              (e: any) => emit('updateStyle', selectedItem, 'borderWidth', Number(e.target.value))
            "
          />
        </div>

        <!-- Node Content -->
        <div
          v-if="selectedItem.type === 'node' && (selectedItem.data as any).type === 'text'"
          class="prop-group"
        >
          <div class="group-title">Text</div>
          <label>Content</label>
          <textarea
            :value="(selectedItem.data as any).text"
            @input="(e: any) => emit('updateContent', selectedItem, e.target.value)"
          ></textarea>
          <label>Font Size</label>
          <input
            type="number"
            :value="(selectedItem.data as any).style.fontSize"
            @change="
              (e: any) => emit('updateStyle', selectedItem, 'fontSize', Number(e.target.value))
            "
          />
        </div>

        <div
          v-if="selectedItem.type === 'node' && (selectedItem.data as any).type === 'image'"
          class="prop-group"
        >
          <div class="group-title">Image</div>
          <label>Source URL</label>
          <textarea
            :value="(selectedItem.data as any).src"
            @change="(e: any) => emit('updateContent', selectedItem, e.target.value)"
          />
        </div>

        <div class="actions-footer">
          <button class="delete-btn" @click="emit('deleteSelected', selectedItem)">
            <svg viewBox="0 0 24 24" class="icon">
              <path
                d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"
              />
            </svg>
            Delete Selection
          </button>
        </div>
      </div>
      <div v-else class="empty-hint">
        <svg viewBox="0 0 24 24" class="icon large">
          <path
            d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"
          />
        </svg>
        Select an element to edit properties
      </div>
    </div>
  </aside>
</template>

<style scoped>
.properties-panel {
  width: 280px;
  background: rgba(18, 18, 20, 0.8);
  border-left: 1px solid rgba(255, 255, 255, 0.05);
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
.empty-hint {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #52525b;
  text-align: center;
  gap: 12px;
  font-size: 13px;
}
.icon.large {
  width: 32px;
  height: 32px;
  opacity: 0.3;
}

.props-editor {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.selection-badge {
  background: rgba(99, 102, 241, 0.1);
  border: 1px solid rgba(99, 102, 241, 0.2);
  padding: 8px 12px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.type-capsule {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  color: #6366f1;
}
.id-text {
  font-size: 11px;
  color: #71717a;
  font-family: monospace;
}

.prop-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.group-title {
  font-size: 11px;
  font-weight: 600;
  color: #a1a1aa;
  margin-bottom: 4px;
}

label {
  font-size: 10px;
  color: #71717a;
  text-transform: uppercase;
  font-weight: 600;
}

input,
textarea {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 4px;
  padding: 6px 8px;
  color: #fff;
  font-size: 13px;
  transition: all 0.2s;
}
input:focus,
textarea:focus {
  outline: none;
  border-color: #6366f1;
  background: rgba(255, 255, 255, 0.05);
}

.prop-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}
.prop-col {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

textarea {
  resize: vertical;
  min-height: 60px;
}

.actions-footer {
  margin-top: 10px;
  padding-top: 20px;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
}

.delete-btn {
  width: 100%;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.2);
  color: #ef4444;
  padding: 10px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}
.delete-btn:hover {
  background: rgba(239, 68, 68, 0.2);
  border-color: #ef4444;
}
.delete-btn .icon {
  width: 16px;
  height: 16px;
  fill: currentColor;
}
</style>
