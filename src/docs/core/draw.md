# Core Rendering Primitives (`src/core/draw`)

Kraflow's drawing engine heavily avoids Object-Oriented tree allocations for rendering logic. Instead of classes, we use extremely thin, stateless functional wrappers that instantly map React Native CSS properties to standard WebGL/CanvasKit rendering structures on-the-fly (`RRect`, `Path`, `Paint`).

Because functions like `view()` run at a locked 60 Frames Per Second (FPS) target, allocating strings into `ck.Paint` dynamically each frame would instantly exhaust WebAssembly memory limits.

## The Caching Architecture (`WeakMap`)

To overcome the performance overhead of stateless functions without polluting user abstractions, Kraflow utilizes hidden `WeakMap<StyleType, CompiledCache>` pipelines.

When you pass a `ViewStyle` object into `view(...)`, the function extracts it as a unique memory pointer mapping inside the cache.

- **Cache Miss (First frame)**: It parses Hex colors, sizes, and calculates drop shadows creating real C++ CanvasKit pointers, returning early or preparing bounds.
- **Cache Hit (Every frame after)**: It completely bypasses parsing operations and drops the memory safe `ck.Paint` structures into optimized execution directly.

_Note: For the best performance, never declare volatile objects directly in the loop `view(..., { backgroundColor: 'red' })`. Declare a single React `StyleSheet` object that preserves stable memory references, matching React Native's standard optimization boundaries._

## Available Node Actions

### 1. View `drawView(...)`

The foundational bounding-box node acting similarly to an HTML `div`.

- Supports background colors, robust flexible borders, drop shadows, and `borderRadius` mapping utilizing `ck.RRectXY`.
- Automatically acts as a `ScrollView`! If `style.overflow` is labeled `'scroll'`, it invokes `canvas.save()`, clips boundaries natively via `ck.ClipOp.Intersect`, and evaluates `canvas.translate(-scroll.x, -scroll.y)`.
- **Important**: Whenever executing Graph iterations over a View outputting translations, ensure you run `restoreView(canvas, style)` afterwards explicitly in the builder hierarchy so subsequent siblings render correctly.

### 2. Text `drawText(...)`

Hooks into the robust asynchronous `FontSystem` backend.

- Due to the nature of fetching and shaping web assemblies text layouts, it is naturally asynchronous. On a cache miss, it will kickstart background Web Workers processing the Paragraph and return immediately, drawing nothing.
- Seconds/Milliseconds later on success, the cache populates and native text is sprayed straight onto mapping coordinates safely scaling against Yoga constraints.

### 3. Image `drawImage(...)`

Builds upon an internal `imageAssetCache` spanning the engine orchestrator.

- Evaluates `fetch` mapping over blob payloads building natively into CanvasKit `Image` memory buffers.
- Resolves cleanly, showing dummy/placeholder shapes natively until decoded and bound successfully to your screen, supporting CSS `opacity` attributes and internal iOS `tintColor` source filters using `ColorFilter.MakeBlendMode()`.
