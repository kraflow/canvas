# Interaction Manager

The `InteractionManager` provides common canvas-based UI interaction patterns like selection, hover, and marquee selection.

## InteractionManager Class

The `InteractionManager` is the primary bridge between the browser window's mouse/touch events and the world-space scene graph.

```ts
import { InteractionManager } from '@/core/interaction'
```

### Constructor

```ts
const interaction = new InteractionManager(canvasElement, scene, viewport)
```

- `canvasElement`: The DOM element to attach the `pointerdown` listener to.
- `scene`: The `SceneGraph` instance to perform hit-testing on.
- `viewport`: The `Viewport` instance to convert between screen and world space.

---

## Interaction Modes

The manager can operate in one of three modes, which dictate how it responds to pointer events.

| Mode     | Description                                                                                    |
| -------- | ---------------------------------------------------------------------------------------------- |
| `'edit'` | **Default.** Cursor selection, node dragging, and marquee selection.                           |
| `'move'` | Panning tool. Left-click pans the viewport.                                                    |
| `'play'` | Play-only mode, disabling all canvas-based selection and editing (for previewing interaction). |

### `setMode(mode: InteractionMode): void`

Switches the current mode and resets the current selection/dragging state.

---

## Interaction State

You can access the current state using `getState()`.

```ts
const state = interaction.getState()
```

| Property         | Type               | Description                                         |
| ---------------- | ------------------ | --------------------------------------------------- | ---------------------------------------------- |
| `selectedNodes`  | `Set<string>` (Id) | Sets of currently selected node IDs.                |
| `hoveredNode`    | `SceneNode         | null`                                               | The node currently under the cursor.           |
| `draggedNode`    | `SceneNode         | null`                                               | The node currently being dragged.              |
| `selectionBox`   | `LayoutRect        | null`                                               | The current world-space marquee selection box. |
| `isPanning`      | `boolean`          | Whether the user is currently panning the viewport. |
| `isBoxSelecting` | `boolean`          | Whether the user is currently marquee-selecting.    |

---

## Event Subscriptions

The `InteractionManager` dispatches events whenever its internal state changes.

```ts
const unsubscribe = interaction.on((event: InteractionEvent) => {
  // Update your UI state or re-render the canvas
  renderer.requestFrame()
})
```

### Common Event Types:

- `modeChange`
- `hover`
- `dragStart`, `dragMove`, `dragEnd`
- `boxSelectStart`, `boxSelectMove`, `boxSelectEnd`
- `panningStart`, `panningMove`, `panningEnd`
- `scroll`

---

## Keyboard Shortcuts (Built-in)

- **Spacebar (Hold):** Temporarily switches to `'move'` mode for panning. Returns to `'edit'` on release.
- **Shift (Hold):** Allows adding/removing from the selection (multi-select).
- **Ctrl/Cmd + Mouse Wheel:** Zooms in and out at the cursor's location.
- **Mouse Wheel:** Pans the viewport vertically or horizontally.
