import { onMounted, onUnmounted } from 'vue'
import type { Ref } from 'vue'

export function useKeyboardShortcuts(showGrid: Ref<boolean>) {
  onMounted(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "'") {
        e.preventDefault()
        showGrid.value = !showGrid.value
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    onUnmounted(() => window.removeEventListener('keydown', handleKeyDown))
  })
}
