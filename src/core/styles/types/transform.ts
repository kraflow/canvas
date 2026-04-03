import type { Length } from './flex'

export interface TransformStyle {
  transform?: Array<
    | { perspective: number }
    | { rotate: `${number}deg` | `${number}rad` }
    | { rotateX: `${number}deg` | `${number}rad` }
    | { rotateY: `${number}deg` | `${number}rad` }
    | { rotateZ: `${number}deg` | `${number}rad` }
    | { scale: number }
    | { scaleX: number }
    | { scaleY: number }
    | { translateX: Length }
    | { translateY: Length }
    | { skewX: `${number}deg` }
    | { skewY: `${number}deg` }
  >
  transformOrigin?:
    | 'center'
    | 'top'
    | 'bottom'
    | 'left'
    | 'right'
    | `${Length} ${Length}`
    | `${Length} ${Length} ${Length}`
}
