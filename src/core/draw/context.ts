import type { Image as CKImage, Paint, Paragraph } from 'canvaskit-wasm'
import type { ViewStyle, TextStyle, ImageStyle } from '../styles'

export interface BaseContext {
  bgPaint: Paint | null
  borderPaint: Paint | null
  shadowPaint: Paint | null
  shadowPaints?: Paint[]
  layerPaint?: Paint | null
  outlinePaint?: Paint | null
}

export interface ViewContext extends BaseContext {
  type: 'view'
  cachedStyleProps?: Partial<ViewStyle>
}

export interface TextContext extends BaseContext {
  type: 'text'
  paragraph: Paragraph | null
  isBuilding: boolean
  cachedContent?: string
  cachedStyleProps?: Partial<TextStyle>
}

export interface ImageContext extends BaseContext {
  type: 'image'
  image: CKImage | null
  cachedStylePaint: Paint | null
  isLoading: boolean
  cachedSrc?: string
  cachedStyleProps?: Partial<ImageStyle>
}

export type DrawContext = ViewContext | TextContext | ImageContext

function getBaseContext(): BaseContext {
  return {
    bgPaint: null,
    borderPaint: null,
    shadowPaint: null,
  }
}

export function createViewContext(): ViewContext {
  return {
    type: 'view',
    ...getBaseContext(),
  }
}

export function createTextContext(): TextContext {
  return {
    type: 'text',
    paragraph: null,
    isBuilding: false,
    ...getBaseContext(),
  }
}

export function createImageContext(): ImageContext {
  return {
    type: 'image',
    image: null,
    cachedStylePaint: null,
    isLoading: false,
    ...getBaseContext(),
  }
}

/**
 * Safely deletes any bound C++ CanvasKit pointers inside the context.
 */
export function destroyContext(ctx: DrawContext): void {
  // Clear base view resources shared on all components
  if (ctx.bgPaint) ctx.bgPaint.delete()
  if (ctx.borderPaint) ctx.borderPaint.delete()
  if (ctx.shadowPaint) ctx.shadowPaint.delete()
  ctx.bgPaint = null
  ctx.borderPaint = null
  ctx.shadowPaint = null

  if (ctx.layerPaint) {
    ctx.layerPaint.delete()
    ctx.layerPaint = null
  }
  if (ctx.shadowPaints) {
    ctx.shadowPaints.forEach((p) => p.delete())
    ctx.shadowPaints = []
  }
  if (ctx.outlinePaint) {
    ctx.outlinePaint.delete()
    ctx.outlinePaint = null
  }

  // Clear specific component resources
  if (ctx.type === 'text') {
    if (ctx.paragraph) ctx.paragraph.delete()
    ctx.paragraph = null
  } else if (ctx.type === 'image') {
    if (ctx.cachedStylePaint) ctx.cachedStylePaint.delete()
    ctx.cachedStylePaint = null
    // Note: Do not delete ctx.image as it is managed by the global internal imageAssetCache.
  }
}
