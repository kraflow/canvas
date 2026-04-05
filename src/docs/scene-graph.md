# Scene Graph

The scene graph manages a tree of UI nodes with Yoga layout and provides high-performance spatial querying (hit-testing).

## SceneGraph Class

The `SceneGraph` is the central manager for all hierarchical UI elements.

```ts
import { SceneGraph } from '@/core/scene'
```

### Static Initialization

```ts
// Requires CanvasKit and a FontSystem for text measurement
const scene = await SceneGraph.create(ck, fonts)
```

---

## Screen Management

A **Screen** is a root-level container positioned freely on the infinite world-space canvas. Screens are the top-most level of the scene graph.

```ts
// Add a screen at world coordinates (0, 0) with a 400x800 size
const screen = scene.addScreen('home', 0, 0, 400, 800)

// Move a screen (updates children worldRects)
scene.moveScreen('home', 100, 200)

// Resize a screen (triggers layout recomputation)
scene.resizeScreen('home', 500, 900)

// Remove a screen and its children
scene.removeScreen('home')
```

---

## Node Management

**Nodes** are the building blocks of your UI.

| Node Type | Style        | Content              |
| --------- | ------------ | -------------------- |
| `view`    | `ViewStyle`  | Children, Scroll     |
| `text`    | `TextStyle`  | `text` string        |
| `image`   | `ImageStyle` | `SkImage` from cache |

### Operations

```ts
// Create (detached)
const box = scene.createNode('view', { width: 100, height: 100, backgroundColor: 'blue' })

// Parent-Child
scene.appendChild(parent, child)
scene.insertChild(parent, child, index)
scene.removeChild(parent, child)

// Content
scene.setText(textNode, 'New Text Content')
scene.applyStyle(node, { ...node.style, opacity: 0.5 })

// Compute and Traversals
scene.computeAllLayouts() // Must call before rendering
scene.walk((node, absoluteRect) => {
  /* Render node */
})
```

---

## Hit-Testing & Spatial Index

The `SceneGraph` maintains a `SpatialIndex` that is rebuilt every time `computeAllLayouts()` is called. This allows for extremely fast intersection queries even with thousands of nodes.

### `hitTest(worldX, worldY): SceneNode | null`

Returns the front-most node at the given world-space coordinates. Respects `pointerEvents: 'none'` styles.

### `boxTest(worldRect): SceneNode[]`

Returns all top-most nodes that intersect with the given world-space marquee selection box. Useful for multi-select.

---

## Serialization & Project Management

You can export and import the entire scene graph state, which is useful for undo/redo and saving projects.

```ts
// Export everything as a JSON-compatible object
const projectData = scene.exportProject()

// Reconstruct the scene graph (clears current state)
await scene.importProject(projectData)
```

---

## Syncing Layout with Yoga

When `applyStyle()` is called, the `SceneGraph` automatically detects if the change affects layout (e.g., `padding`, `width`, `flexDirection`). If it does, the Yoga node is updated, and the screen is marked as dirty for the next `computeAllLayouts()` call.
