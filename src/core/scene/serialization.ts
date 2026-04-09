import type { SceneNode, ScreenNode, SerializedSceneNode, SerializedScreenNode } from './types'

/**
 * Converts a runtime SceneNode (with Yoga/CanvasKit objects) to a
 * plain data object suitable for JSON serialization.
 */
export function toSerializableNode(node: SceneNode): SerializedSceneNode {
  return {
    id: node.id,
    type: node.type,
    style: { ...node.style },
    text: node.text,
    src: node.src,
    scroll: node.scroll ? { ...node.scroll } : undefined,
    children: node.children.map(toSerializableNode),
  }
}

/**
 * Converts a runtime ScreenNode to its serializable data version.
 */
export function toSerializableScreen(screen: ScreenNode): SerializedScreenNode {
  return {
    id: screen.id,
    name: screen.name,
    x: screen.x,
    y: screen.y,
    width: screen.width,
    height: screen.height,
    root: toSerializableNode(screen.root),
  }
}
