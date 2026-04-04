# Scene Graph

The scene graph manages a tree of UI nodes with Yoga layout. It is fully **decoupled from the renderer** — it provides a `walk()` function that you call in your `onDraw` callback.

## Core Concepts

| Concept | Description |
|---------|-------------|
| **SceneGraph** | Manages multiple screens. Provides `walk()` for traversal |
| **ScreenNode** | Root container at a custom `(x, y)` on the infinite canvas. Not Yoga-managed |
| **SceneNode** | A node with type, style, children, and an attached Yoga node |
| **Yoga node** | Layout engine node attached to each SceneNode. Computes position/size |
| **rect** | Computed `{ x, y, w, h }` from Yoga's `getComputedLayout()` |
| **walk()** | DFS traversal that yields each node with its absolute canvas rect |

## Creating a Scene Graph

```ts
import { SceneGraph } from '@/core/scene'

// Loads Yoga WASM — must await
const scene = await SceneGraph.create()
```

> **Important:** All yoga imports use `yoga-layout/load` (the async entry) to avoid top-level await issues with Vite.

## Screens

A Screen is a root-level container positioned freely on the infinite canvas. Each screen has its own Yoga layout tree.

```ts
// Add a screen at canvas position (100, 50) with size 400×600
const screen = scene.addScreen('main', 100, 50, 400, 600)

// Move it
scene.moveScreen('main', 200, 100)

// Resize it (marks layout as dirty)
scene.resizeScreen('main', 500, 700)

// Remove it (frees all Yoga nodes)
scene.removeScreen('main')
```

Access screens:
```ts
const screen = scene.getScreen('main')

for (const screen of scene.allScreens) {
  console.log(screen.id, screen.x, screen.y)
}
```

## Nodes

### Node Types

| Type | Style | Extra Fields |
|------|-------|-------------|
| `'view'` | `ViewStyle` | `scroll?: ScrollPosition` |
| `'text'` | `TextStyle` | `text?: string` |
| `'image'` | `ImageStyle` | `image?: Image \| null` |

### Creating Nodes

```ts
// Creates a detached node (not in the tree yet)
const card = scene.createNode('view', {
  backgroundColor: Float32Array.from([0.1, 0.1, 0.15, 1]),
  borderRadius: 16,
  padding: 20,
  flexDirection: 'column',
  gap: 12,
})
```

Style properties are automatically synced to the Yoga node — flexDirection, width, height, padding, margin, gap, position, etc.

### Tree Operations

```ts
// Append
scene.appendChild(screen.root, card)

// Insert at index
scene.insertChild(screen.root, card, 0)

// Remove (detaches from parent, does NOT free Yoga node)
scene.removeChild(screen.root, card)

// Destroy a detached node (frees Yoga resources)
scene.destroyNode(card)
```

### Setting Content

```ts
// Text nodes
const title = scene.createNode('text', {
  color: Float32Array.from([1, 1, 1, 1]),
  fontSize: 24,
  fontWeight: 700,
  fontFamily: 'Inter',
  height: 32,  // Fixed height (text measurement is future work)
})
title.text = 'Hello World'
scene.appendChild(card, title)

// Image nodes
const img = scene.createNode('image', {
  borderRadius: 12,
  overflow: 'hidden',
  height: 200,
})
img.image = await imageCache.load('https://example.com/photo.jpg')
scene.appendChild(card, img)
```

### Updating Styles

```ts
// Updates style AND syncs layout-relevant props to Yoga
scene.applyStyle(card, {
  ...card.style,
  backgroundColor: Float32Array.from([0.2, 0.2, 0.25, 1]),
  padding: 32,
})
```

## Layout Computation

Layout is computed per-screen using Yoga's flexbox engine.

```ts
// Compute a specific screen's layout
scene.computeLayout(screen)

// Compute all dirty screens
scene.computeAllLayouts()
```

After computation, each node's `rect` is populated with its Yoga-computed position and size (relative to parent).

**Dirty tracking:** Screens are automatically marked dirty when:
- Nodes are added/removed
- Styles are updated via `applyStyle()`
- Screen is resized via `resizeScreen()`

## Walking the Tree (Rendering)

The `walk()` function traverses all screens and nodes in DFS order, computing **absolute** canvas coordinates:

```ts
scene.walk((node, absoluteRect) => {
  // absoluteRect = { x, y, w, h } in canvas coordinates
  // node.type = 'view' | 'text' | 'image'
  // node.style, node.text, node.image, node.scroll, etc.
})
```

### Typical Render Loop

```ts
function onDraw(canvas: Canvas, ck: CanvasKit) {
  drawCtx.beginFrame()

  scene.walk((node, rect) => {
    switch (node.type) {
      case 'view':
        renderView(ck, canvas, node.style as ViewStyle, rect, node.scroll, undefined, drawCtx)
        break
      case 'text':
        renderText(ck, canvas, node.style as TextStyle, rect, node.text ?? '', fonts, null, drawCtx)
        break
      case 'image':
        renderImage(ck, canvas, node.style as ImageStyle, rect, node.image ?? null, drawCtx)
        break
    }
  })
}
```

### Walk a Single Screen

```ts
scene.walkScreen(screen, (node, rect) => {
  // Only this screen's nodes
})
```

## Style → Yoga Mapping

The `syncStyleToYoga()` function maps all `FlexStyle` properties to Yoga node setters:

| Style Property | Yoga Setter |
|---------------|-------------|
| `flexDirection` | `setFlexDirection()` |
| `flexWrap` | `setFlexWrap()` |
| `justifyContent` | `setJustifyContent()` |
| `alignItems` / `alignContent` / `alignSelf` | `setAlignItems()` / etc. |
| `flex` / `flexGrow` / `flexShrink` / `flexBasis` | `setFlex()` / etc. |
| `width` / `height` | `setWidth()` / `setHeight()` (supports `number`, `'auto'`, `'50%'`) |
| `minWidth` / `maxWidth` / `minHeight` / `maxHeight` | corresponding setters |
| `padding` / `paddingTop` / etc. | `setPadding(edge, value)` |
| `margin` / `marginTop` / etc. | `setMargin(edge, value)` (supports `'auto'`) |
| `position` / `top` / `bottom` / `left` / `right` | `setPositionType()` / `setPosition()` |
| `borderWidth` / `borderTopWidth` / etc. | `setBorder(edge, value)` |
| `gap` / `rowGap` / `columnGap` | `setGap(gutter, value)` |
| `display` | `setDisplay()` |
| `overflow` | `setOverflow()` |
| `aspectRatio` | `setAspectRatio()` (supports `'16/9'` string) |
| `boxSizing` | `setBoxSizing()` |

## Cleanup

```ts
// Frees ALL Yoga nodes across all screens
scene.dispose()
```

## Limitations (Current)

| Feature | Status |
|---------|--------|
| Text measurement (`measureFunc`) | Not yet — use fixed `height` on text nodes |
| zIndex draw ordering | Not yet — DFS tree order only |
| Event hit testing | Not yet — planned reverse-walk |
| Scroll indicators | Not yet — `scroll` offset is supported via `renderView` |
