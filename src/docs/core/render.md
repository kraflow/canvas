# render usage

The core module for bootstrapping the WebGL CanvasKit surface and driving the central animation loop.

---

## quick start

```ts
import { createRenderer } from '@/core/render'

const canvasElement = document.getElementById('my-canvas') as HTMLCanvasElement

const renderer = createRenderer({
  canvasElement,
  pixelRatio: window.devicePixelRatio,
  onDraw: (canvas, ck) => {
    // CanvasKit drawing logic here
    const paint = new ck.Paint()
    paint.setColor(ck.RED)
    paint.setStyle(ck.PaintStyle.Fill)
    canvas.drawRect(ck.LTRBRect(10, 10, 100, 100), paint)
    paint.delete()
  },
})

// Loads CanvasKit and wires up the WebGL surface
await renderer.init()
```

---

## the render loop

Once the renderer is initialized, it won't continuously re-draw unless you activate the animation loop. This saves battery/CPU when nothing is changing.

### manual drawing

For static canvases or one-off changes, you can just manually trigger a draw.

```ts
// Automatically invokes the onDraw function provided during createdRenderer
renderer.draw()
```

### continuous drawing

The most common use case is interacting with the canvas, dragging elements, etc. Toggle the animation loop to true and it will fire the `onDraw` loop using `requestAnimationFrame`.

```ts
// Starts the requestAnimationFrame loop
renderer.setAnimating(true)

// Later, to pause or stop CPU usage:
renderer.setAnimating(false)
```

### hot-swapping draw code

You can override the `onDraw` function at runtime without destroying the WebGL context.

```ts
renderer.setDrawFunction((canvas, ck) => {
  // Completely new rendering logic
})
```

---

## responsiveness & sizing

Canvas relies heavily on matching its logical `<canvas>` attributes (`width`/`height`) to its physical CSS boundaries. To maintain crisp edges across retina displays, adjust both dynamically.

```ts
// If the window resizes, ensure you forward the CSS dimensions
window.addEventListener('resize', () => {
  renderer.resize(window.innerWidth, window.innerHeight)
})

// If the user's monitor changes DPI profile (e.g. moving between screens)
renderer.setPixelRatio(window.devicePixelRatio)
```

_(Note: Both of these operations are highly optimized but do result in tearing down the active `Surface` and constructing a new one. The `Renderer` abstracts this memory lifecycle for you)._

---

## teardown

If the component hosting the canvas unmounts, you must dispose the renderer to free the active WebGL surface, clear animation frames, and prevent memory leaks.

```ts
renderer.dispose()
```

---

## module map

| file          | exports                                         | purpose                       |
| ------------- | ----------------------------------------------- | ----------------------------- |
| `load.ts`     | `loadCanvasKit`                                 | CanvasKit CDN / Local Fetcher |
| `renderer.ts` | `createRenderer`, `Renderer`, `RendererOptions` | WebGL surface orchestration   |
