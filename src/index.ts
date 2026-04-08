export const version = __VERSION__

// Configuration API
export { CONFIG as config, configure, resetConfig, type ConfigOptions } from './core/constants'

// Core Modules
export * from './core/renderer'
export * from './core/scene'
export * from './core/viewport'
export * from './core/interaction'
export * from './core/styles'
export * from './core/fonts'
