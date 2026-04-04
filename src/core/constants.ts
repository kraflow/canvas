/**
 * Whether the current environment is development or production. This can be used to conditionally include debug information or enable certain features only in development mode.
 *
 * The value of IS_DEV is determined by the build tool (e.g., Vite, Webpack) based on the NODE_ENV environment variable. In development mode, NODE_ENV is typically set to 'development', while in production mode, it is set to 'production'.
 *
 * @constant {boolean} IS_DEV - A boolean value that is true if the current environment is development, and false if it is production.
 */
export const IS_DEV = import.meta.env.DEV
