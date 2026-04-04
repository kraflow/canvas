# Styles

Style types follow the **React Native** specification. They define both visual appearance (colors, shadows, borders) and layout (flex, sizing, position).

```ts
import type { ViewStyle, TextStyle, ImageStyle, FlexStyle } from '@/core/styles'
```

## Style Hierarchy

```
FlexStyle          ← Layout-only properties (flex, sizing, margins, padding)
  └── ViewStyle    ← Visual properties (colors, borders, shadows, transforms)
       ├── TextStyle   ← Text rendering (font, color, decoration, alignment)
       └── ImageStyle  ← Image rendering (objectFit, tintColor)
```

## FlexStyle (Layout)

All layout properties consumed by Yoga.

### Flex Container

```ts
{
  flexDirection: 'row' | 'row-reverse' | 'column' | 'column-reverse',  // default: 'column'
  flexWrap: 'wrap' | 'nowrap' | 'wrap-reverse',                        // default: 'nowrap'
  justifyContent: 'flex-start' | 'flex-end' | 'center'
    | 'space-between' | 'space-around' | 'space-evenly',               // default: 'flex-start'
  alignItems: 'flex-start' | 'flex-end' | 'center'
    | 'stretch' | 'baseline',                                           // default: 'stretch'
  alignContent: 'flex-start' | 'flex-end' | 'center'
    | 'stretch' | 'space-between' | 'space-around' | 'space-evenly',
  gap: number,
  rowGap: number,
  columnGap: number,
}
```

### Flex Item

```ts
{
  flex: number,              // shorthand
  flexGrow: number,
  flexShrink: number,
  flexBasis: number | string, // number | 'auto' | '50%'
  alignSelf: 'auto' | 'flex-start' | 'flex-end' | 'center' | 'stretch' | 'baseline',
}
```

### Sizing

```ts
{
  width: number | string,     // number | 'auto' | '50%'
  height: number | string,
  minWidth: number | string,
  maxWidth: number | string,
  minHeight: number | string,
  maxHeight: number | string,
  aspectRatio: number | string, // 1.5 or '16/9'
  boxSizing: 'border-box' | 'content-box',
}
```

### Position

```ts
{
  position: 'relative' | 'absolute' | 'static',  // default: 'relative'
  top: number | string,
  bottom: number | string,
  left: number | string,
  right: number | string,
}
```

### Box Model

```ts
{
  margin: number | string,     // number | 'auto' | '10%'
  marginTop: number | string,
  marginBottom: number | string,
  marginLeft: number | string,
  marginRight: number | string,

  padding: number | string,    // number | '10%'
  paddingTop: number | string,
  paddingBottom: number | string,
  paddingLeft: number | string,
  paddingRight: number | string,

  borderWidth: number,
  borderTopWidth: number | string,
  borderBottomWidth: number,
  borderLeftWidth: number,
  borderRightWidth: number,
}
```

### Other

```ts
{
  display: 'none' | 'flex' | 'contents',
  direction: 'inherit' | 'ltr' | 'rtl',
  overflow: 'visible' | 'hidden' | 'scroll',
  zIndex: number,
  isolation: 'auto' | 'isolate',
}
```

---

## ViewStyle (Visual)

Extends `FlexStyle`. All visual-only properties (not consumed by Yoga — used by the renderer).

### Background & Opacity

```ts
{
  backgroundColor: ColorValue,  // Float32Array [r,g,b,a] or number
  opacity: number,              // 0-1
}
```

### Borders

```ts
{
  borderColor: ColorValue,
  borderTopColor: ColorValue,
  borderBottomColor: ColorValue,
  borderLeftColor: ColorValue,
  borderRightColor: ColorValue,
  borderStyle: 'solid' | 'dotted' | 'dashed',
  borderRadius: number | string,
  borderTopLeftRadius: number | string,
  borderTopRightRadius: number | string,
  borderBottomLeftRadius: number | string,
  borderBottomRightRadius: number | string,
  borderCurve: 'circular' | 'continuous',  // iOS superellipse
}
```

### Shadows

```ts
{
  boxShadow: BoxShadowValue[],
}

// Each shadow:
interface BoxShadowValue {
  offsetX: number
  offsetY: number
  blurRadius?: number
  spreadDistance?: number
  color?: ColorValue
  inset?: boolean         // true = inner shadow
}
```

### Transforms

```ts
{
  transform: [
    { translateX: 10 },
    { translateY: 20 },
    { rotate: '45deg' },
    { scale: 1.5 },
    { skewX: '10deg' },
    { matrix: [1, 0, 0, 1, 0, 0] },
  ],
  transformOrigin: '50% 50%',  // or [number | string]
}
```

### Filters

```ts
{
  filter: [
    { blur: 4 },
    { brightness: 1.2 },
    { contrast: 0.8 },
    { grayscale: 0.5 },
    { hueRotate: '90deg' },
    { invert: 1 },
    { sepia: 0.3 },
    { saturate: 1.5 },
    { opacity: 0.9 },
    { dropShadow: { offsetX: 2, offsetY: 4, standardDeviation: 3, color: ... } },
  ],
}
```

### Blend Mode

```ts
{
  mixBlendMode: 'normal' | 'multiply' | 'screen' | 'overlay'
    | 'darken' | 'lighten' | 'color-dodge' | 'color-burn'
    | 'hard-light' | 'soft-light' | 'difference' | 'exclusion'
    | 'hue' | 'saturation' | 'color' | 'luminosity',
}
```

### Outline

```ts
{
  outlineColor: ColorValue,
  outlineOffset: number,
  outlineStyle: 'solid' | 'dotted' | 'dashed',
  outlineWidth: number,
}
```

### Pointer Events

```ts
{
  pointerEvents: 'auto' | 'box-none' | 'box-only' | 'none',
  cursor: 'auto' | 'pointer',
}
```

---

## TextStyle

Extends `ViewStyle`.

```ts
{
  color: ColorValue,
  fontFamily: string,
  fontSize: number,
  fontWeight: 'normal' | 'bold' | 100-900,
  fontStyle: 'normal' | 'italic',
  fontVariant: ['small-caps', 'tabular-nums', ...],
  letterSpacing: number,
  lineHeight: number,
  textAlign: 'auto' | 'left' | 'right' | 'center' | 'justify',
  textAlignVertical: 'auto' | 'top' | 'bottom' | 'center',
  textDecorationLine: 'none' | 'underline' | 'line-through' | 'underline line-through',
  textDecorationStyle: 'solid' | 'double' | 'dotted' | 'dashed',
  textDecorationColor: ColorValue,
  textShadowColor: ColorValue,
  textShadowOffset: { width: number, height: number },
  textShadowRadius: number,
  textTransform: 'none' | 'uppercase' | 'lowercase' | 'capitalize',
  userSelect: 'auto' | 'text' | 'none' | 'contain' | 'all',
}
```

---

## ImageStyle

Extends `ViewStyle`.

```ts
{
  resizeMode: 'cover' | 'contain' | 'stretch' | 'repeat' | 'center',
  objectFit: 'cover' | 'contain' | 'fill' | 'scale-down',
  tintColor: ColorValue,
  overlayColor: string,  // Android only
}
```

---

## ColorValue

Colors can be specified as:

```ts
// Float32Array (recommended — zero conversion)
Float32Array.from([1.0, 0.5, 0.0, 1.0])[ // RGBA [0-1]
  // Number array
  (255, 128, 0, 255)
]

// CanvasKit color
ck.Color(255, 128, 0, 255)
```

> **Tip:** Use `Float32Array` for best performance — avoids conversion in the draw path.
