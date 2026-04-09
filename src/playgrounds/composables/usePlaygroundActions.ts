import { ref } from 'vue'
import type {
  SceneGraph,
  SceneNode,
  ViewStyle,
  TextStyle,
  ScreenNode,
  InteractionManager,
} from '@/index'
import {
  PLAYGROUND_VIEW_BG,
  PLAYGROUND_VIEW_BORDER,
  PLAYGROUND_TEXT_COLOR,
  PLAYGROUND_TEXT_BORDER,
  PLAYGROUND_IMAGE_BORDER,
} from './usePlaygroundCore'

export function usePlaygroundActions(
  scene: ReturnType<typeof ref<SceneGraph | null>>,
  interaction: ReturnType<typeof ref<InteractionManager | null>>,
  startPlacingScreen: () => void,
  requestFrame: () => void,
  triggerSceneUpdate: () => void,
) {
  const addNode = (type: 'view' | 'text' | 'image') => {
    if (!scene.value) return

    let textContent = 'New Text Layer'
    let imageUrl =
      'https://picsum.photos/seed/' + Math.random().toString(36).substring(7) + '/400/300'

    if (type === 'text') {
      const input = prompt('Enter text content:', 'New Text Layer')
      if (input !== null) textContent = input
    } else if (type === 'image') {
      const input = prompt(
        'Enter image URL:',
        'https://picsum.photos/seed/' + Math.random().toString(36).substring(7) + '/400/300',
      )
      if (input !== null) imageUrl = input
    }

    // 1. Determine parent
    let parent: SceneNode | null = null
    const selectedIds = interaction.value?.getState().selectedNodes || new Set()

    if (selectedIds.size === 1) {
      const id = Array.from(selectedIds)[0] as string
      let target = scene.value.getNode(id)
      const screen = scene.value.getScreen(id)

      if (screen) {
        parent = (screen as ScreenNode).root
      } else if (target) {
        // If selected target is not a view, find nearest view parent
        while (target && target.type !== 'view') {
          target = target.parent as SceneNode
        }
        parent = target
      }
    }

    // 2. Default to first screen if no parent found
    if (!parent) {
      const screens = Array.from(scene.value.allScreens)
      const firstScreen = screens[0]
      if (!firstScreen) {
        startPlacingScreen()
        return
      }
      parent = (firstScreen as ScreenNode).root
    }

    const isText = type === 'text'

    // Ensure parent is not null before using it
    if (!parent) return

    const baseStyle = {
      backgroundColor: type === 'view' ? PLAYGROUND_VIEW_BG : undefined,
      width: isText ? undefined : parent.rect.w - 20 * 2,
      height: isText ? undefined : 200,
      margin: 20,
      padding: isText ? 0 : 16,
      borderRadius: 8,
      borderWidth: type === 'view' ? 1.5 : 0,
      borderColor:
        type === 'view'
          ? PLAYGROUND_VIEW_BORDER
          : isText
            ? PLAYGROUND_TEXT_BORDER
            : PLAYGROUND_IMAGE_BORDER,
    }

    const newNode = isText
      ? scene.value.createNode(type, {
          ...baseStyle,
          color: PLAYGROUND_TEXT_COLOR,
          fontSize: 16,
        } as TextStyle)
      : scene.value.createNode(type, baseStyle as ViewStyle)

    if (type === 'text') {
      scene.value.setText(newNode, textContent)
    } else if (type === 'image') {
      scene.value.setSrc(newNode, imageUrl)
    }

    scene.value.appendChild(parent, newNode)
    triggerSceneUpdate()
    requestFrame()
  }

  const deleteSelected = (
    selectedItem: { type: string; data: SceneNode | { id: string } } | null,
  ) => {
    if (!selectedItem || !scene.value) return
    const { type, data } = selectedItem
    if (type === 'node') {
      scene.value.destroyNode(data as SceneNode)
    } else {
      scene.value.removeScreen((data as { id: string }).id)
    }
    triggerSceneUpdate()
    requestFrame()
  }

  const updateStyle = (
    selectedItem: { type: string; data: SceneNode } | null,
    key: string,
    value: string | number | undefined,
  ) => {
    if (!selectedItem || selectedItem.type !== 'node') return
    const node = selectedItem.data as SceneNode
    scene.value?.applyStyle(node, { [key]: value })
    triggerSceneUpdate()
    requestFrame()
  }

  const updateContent = (selectedItem: { type: string; data: SceneNode } | null, value: string) => {
    if (!selectedItem || selectedItem.type !== 'node') return
    const node = selectedItem.data as SceneNode
    if (node.type === 'text') {
      scene.value?.setText(node, value)
    } else if (node.type === 'image') {
      scene.value?.setSrc(node, value)
    }
    triggerSceneUpdate()
    requestFrame()
  }

  return {
    addNode,
    deleteSelected,
    updateStyle,
    updateContent,
  }
}
