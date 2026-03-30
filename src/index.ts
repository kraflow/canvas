export const version = __VERSION__

export { Renderer } from '@/lib/render/Renderer'
export {
  StyleResolver,
  type ResolvedBorder,
  type ResolvedRadius,
  type ResolvedShadow,
  type ResolvedViewStyle,
  type ResolvedTextStyle,
  type ResolvedImageStyle,
} from '@/lib/styles/StyleResolver'

export type * from '@/lib/styles/types'

export type { LayoutRect } from '@/lib/render/NodeRender'
