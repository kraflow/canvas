# Font System

The font system loads fonts on demand, segments text by font coverage, and builds CanvasKit Paragraph objects for rendering.

## Creating a Font System

```ts
import { createFontSystem, type FontSystem } from '@/core/fonts'

const fonts = await createFontSystem(ck, {
  families: {
    Inter: {
      weights: [400, 600, 700],
      variants: {
        '400': {
          url: 'https://cdn.jsdelivr.net/fontsource/fonts/inter@latest/latin-400-normal.ttf',
          priority: 'eager',    // loaded immediately
        },
        '600': {
          url: 'https://cdn.jsdelivr.net/fontsource/fonts/inter@latest/latin-600-normal.ttf',
          priority: 'lazy',     // loaded when needed
        },
        '700': {
          url: 'https://cdn.jsdelivr.net/fontsource/fonts/inter@latest/latin-700-normal.ttf',
          priority: 'lazy',
        },
      },
      unicodeRanges: ['U+0000-00FF'],  // Latin characters
    },
    NotoSansJP: {
      weights: [400],
      variants: {
        '400': {
          url: 'https://cdn.jsdelivr.net/.../noto-sans-jp-400.ttf',
          priority: 'on-demand',  // loaded only when text needs it
        },
      },
      unicodeRanges: ['U+3040-309F', 'U+30A0-30FF', 'U+4E00-9FFF'],
    },
  },
  fallbackChain: ['Inter', 'NotoSansJP'],
  eagerLoad: ['Inter'],
})
```

## Font Manifest

The manifest describes all available fonts:

```ts
interface FontManifest {
  families: Record<string, FontFamily>   // family name → definition
  fallbackChain: string[]                // ordered font fallback
  eagerLoad: string[]                    // families to load at init
}

interface FontFamily {
  weights: number[]                                 // available weights
  variants: Record<string, FontVariant>             // weight string → variant
  unicodeRanges?: string[]                          // Unicode ranges covered
}

interface FontVariant {
  url: string                              // URL to the .ttf file
  priority: 'eager' | 'lazy' | 'on-demand' // load strategy
}
```

**Priority levels:**

| Priority | When loaded |
|----------|-------------|
| `eager` | During `createFontSystem()` — blocks initialization |
| `lazy` | First time a text node requests that weight |
| `on-demand` | When text segmentation detects characters needing this font |

## Loading Fonts

```ts
// Load a specific variant
await fonts.load('Inter', 700)

// Prepare for rendering specific text (loads missing fonts automatically)
const fontMgr = await fonts.prepareForText('Hello こんにちは', 'Inter', 400)
```

## Building Paragraphs

### Async (loads fonts if needed)

```ts
const paragraph = await fonts.makeParagraph(
  'Hello World',
  'Inter',
  {
    fontSize: 16,
    color: new Float32Array([1, 1, 1, 1]),
    fontWeight: 400,
    letterSpacing: 0.5,
    lineHeight: 24,
    textAlign: ck.TextAlign.Left.value,
  },
  300,  // maxWidth
)

canvas.drawParagraph(paragraph, x, y)
paragraph.delete()  // Always delete when done
```

### Sync (assumes fonts are already loaded)

```ts
const paragraph = fonts.makeParagraphSync('Hello', 'Inter', opts, 300)
```

> ⚠️ `makeParagraphSync` throws if fonts haven't been loaded yet.

## Paragraph Options

```ts
interface ParagraphOptions {
  // Typography
  fontSize: number
  color?: Float32Array                     // RGBA [0-1]
  fontFamilies?: string[]                  // additional families
  fontWeight?: number                      // 100-900
  italic?: boolean
  letterSpacing?: number
  lineHeight?: number
  heightMultiplier?: number                // lineHeight / fontSize
  fontFeatures?: { name: string; value: number }[]  // e.g. 'smcp', 'tnum'

  // Layout
  textAlignValue?: number                  // ck.TextAlign.*.value
  textDirectionRTL?: boolean
  textAlignVertical?: 'top' | 'center' | 'bottom'
  textTransform?: 'none' | 'uppercase' | 'lowercase' | 'capitalize'

  // Decoration
  decoration?: number                      // ck.UnderlineDecoration | LineThroughDecoration
  decorationStyle?: EmbindEnumEntity       // ck.DecorationStyle.*
  decorationColor?: Float32Array

  // Shadow
  textShadow?: {
    color: Float32Array
    offsetX: number
    offsetY: number
    blurRadius: number
  } | null
}
```

## Text Segmentation

When text contains characters from multiple Unicode ranges (e.g., Latin + Japanese), the font system automatically segments it and assigns the correct font family per segment:

```
"Hello こんにちは World"
→ [{ text: "Hello ", family: "Inter" },
   { text: "こんにちは", family: "NotoSansJP" },
   { text: " World", family: "Inter" }]
```

This is handled internally by `segmentText()` using the manifest's `unicodeRanges`.

## Sub-Modules

For advanced use, the FontSystem exposes its internals:

```ts
fonts.store      // FontStore — raw font data (ArrayBuffer) storage
fonts.loader     // FontLoader — fetch + decode
fonts.registry   // TypefaceRegistry — CanvasKit Typeface management
fonts.pictures   // PictureCache — cached SkPicture objects
```

## Cleanup

```ts
fonts.dispose()  // Deletes FontMgr, clears typefaces, disposes picture cache
```
