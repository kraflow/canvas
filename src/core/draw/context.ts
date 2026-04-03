import type { Image as CKImage, Paint, Paragraph } from 'canvaskit-wasm'
import type { ViewStyle, TextStyle, ImageStyle } from '../styles'

export interface ViewContext {
  type: 'view'
  bgPaint: Paint | null
  borderPaint: Paint | null
  shadowPaint: Paint | null
  cachedStyleProps?: Partial<ViewStyle>
}

export interface TextContext {
  type: 'text'
  paragraph: Paragraph | null
  isBuilding: boolean
  cachedContent?: string
  cachedStyleProps?: Partial<TextStyle>
}

export interface ImageContext {
  type: 'image'
  image: CKImage | null
  cachedStylePaint: Paint | null
  isLoading: boolean
  cachedSrc?: string
  cachedStyleProps?: Partial<ImageStyle>
}

export type DrawContext = ViewContext | TextContext | ImageContext

export function createViewContext(): ViewContext {
  return {
    type: 'view',
    bgPaint: null,
    borderPaint: null,
    shadowPaint: null,
  }
}

export function createTextContext(): TextContext {
  return {
    type: 'text',
    paragraph: null,
    isBuilding: false,
  }
}

export function createImageContext(): ImageContext {
  return {
    type: 'image',
    image: null,
    cachedStylePaint: null,
    isLoading: false,
  }
}

/**
 * Safely deletes any bound C++ CanvasKit pointers inside the context.
 */
export function destroyContext(ctx: DrawContext): void {
  if (ctx.type === 'view') {
    if (ctx.bgPaint) ctx.bgPaint.delete()
    if (ctx.borderPaint) ctx.borderPaint.delete()
    if (ctx.shadowPaint) ctx.shadowPaint.delete()
    ctx.bgPaint = null
    ctx.borderPaint = null
    ctx.shadowPaint = null
  } else if (ctx.type === 'text') {
    if (ctx.paragraph) ctx.paragraph.delete()
    ctx.paragraph = null
  } else if (ctx.type === 'image') {
    if (ctx.cachedStylePaint) ctx.cachedStylePaint.delete()
    ctx.cachedStylePaint = null
    // Note: Do not delete ctx.image as it is managed by the global internal imageAssetCache.
  }
}
