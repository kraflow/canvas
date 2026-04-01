import Yoga, { type MeasureFunction } from 'yoga-layout'

import {
  TEXT_LAYOUT_PROPS,
  type ResolvedTextStyle,
  type StyleResolver,
} from '../styles/StyleResolver'
import { createAndLayoutParagraph } from '../render/NodeRender'
import type { TextStyle } from '../styles/types'
import type { SceneNode } from './types'
import type { Renderer } from '../render/Renderer'

function extractTextLayoutProperties(style?: TextStyle) {
  if (!style) return {}

  const result: TextStyle = {}
  for (const key of TEXT_LAYOUT_PROPS) {
    if (key in style) {
      // @ts-expect-error ignore it
      result[key] = style[key]
    }
  }
  return result
}

export function createTextMeasureFunction(
  renderer: Renderer,
  resolver: StyleResolver,
  node: SceneNode<'text'>,
): MeasureFunction {
  let lastKey: string = ''
  let lastSize: {
    width: number
    height: number
  } | null = null

  return (availableWidth, widthMode, _availableHeight, _heightMode) => {
    const base = extractTextLayoutProperties(node.style)
    const currentKey = JSON.stringify(base)

    if (lastKey === currentKey) {
      return lastSize!
    }

    lastKey = currentKey

    const rs: ResolvedTextStyle = resolver.buildTextLayoutStyle(base) as ResolvedTextStyle

    let constraintWidth = 0

    if (widthMode === Yoga.MEASURE_MODE_EXACTLY) {
      constraintWidth = availableWidth
    } else if (widthMode === Yoga.MEASURE_MODE_AT_MOST) {
      constraintWidth = availableWidth // max width
    } else {
      constraintWidth = 10000
    }

    const { paragraph, textHeight, longestLine } = createAndLayoutParagraph(
      renderer.getCk()!,
      renderer.getFontMgr()!,
      rs,
      node.text,
      constraintWidth,
    )

    let measuredWidth: number
    const measuredHeight = textHeight

    if (widthMode === Yoga.MEASURE_MODE_EXACTLY) {
      measuredWidth = availableWidth
    } else {
      measuredWidth = Math.ceil(longestLine)
    }

    paragraph.delete()
    return (lastSize = { width: measuredWidth, height: measuredHeight })
  }
}
