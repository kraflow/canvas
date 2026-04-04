export * from './types/flex'
export * from './types/view'
export * from './types/text'
export * from './types/image'

/** Recursive array for style nesting support */
export type RecursiveArray<T> = Array<T | RecursiveArray<T>>

/** Standard React Native-style prop that can be a single style or an array/nest of styles */
export type StyleProp<T> = T | RecursiveArray<T | null | undefined> | null | undefined
