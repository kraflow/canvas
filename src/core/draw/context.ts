import type { Image as CKImage, Paragraph } from 'canvaskit-wasm'
import type { ViewStyle, TextStyle, ImageStyle } from '../styles'

export interface ViewContext {
  type: 'view'
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
  isLoading: boolean
  cachedSrc?: string
  cachedStyleProps?: Partial<ImageStyle>
}

export type DrawContext = ViewContext | TextContext | ImageContext

export function createViewContext(): ViewContext {
  return {
    type: 'view',
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
    isLoading: false,
  }
}

/**
 * Safely deletes any bound C++ CanvasKit pointers inside the context.
 */
export function destroyContext(ctx: DrawContext): void {
  // Clear specific component resources
  if (ctx.type === 'text') {
    if (ctx.paragraph) ctx.paragraph.delete()
    ctx.paragraph = null
  } else if (ctx.type === 'image') {
    // Note: Do not delete ctx.image as it is managed by the global internal imageAssetCache.
  }
}
