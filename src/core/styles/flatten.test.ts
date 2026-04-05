import { describe, it, expect } from 'vitest'
import { flattenStyle } from './flatten'
import { type ViewStyle } from './types/view'

describe('flattenStyle', () => {
  it('should return an empty object for null/undefined', () => {
    expect(flattenStyle(null)).toEqual({})
    expect(flattenStyle(undefined)).toEqual({})
  })

  it('should return a single style object as-is', () => {
    const style: ViewStyle = { backgroundColor: [1, 0, 0, 1], width: 100 }
    expect(flattenStyle(style)).toEqual(style)
  })

  it('should flatten a simple array of styles', () => {
    const s1: ViewStyle = { backgroundColor: [1, 0, 0, 1], width: 100 }
    const s2: ViewStyle = { backgroundColor: [0, 0, 1, 1], height: 200 }
    const result = flattenStyle([s1, s2])

    expect(result).toEqual({
      backgroundColor: [0, 0, 1, 1],
      width: 100,
      height: 200,
    })
  })

  it('should flatten nested arrays and skip nulls', () => {
    const s1: ViewStyle = { width: 100 }
    const s2: ViewStyle = { height: 200 }
    const s3: ViewStyle = { width: 300 }

    const result = flattenStyle([s1, [null, s2, undefined], s3])

    expect(result).toEqual({
      width: 300,
      height: 200,
    })
  })

  it('should expand margin shorthands', () => {
    const style = { margin: 10 }
    const result = flattenStyle(style)

    expect(result).toEqual({
      marginTop: 10,
      marginBottom: 10,
      marginLeft: 10,
      marginRight: 10,
    })
  })

  it('should handle shorthand overrides in arrays (Last-In Wins)', () => {
    // Specifically testing the scenario the user mentioned:
    // borderLeftWidth is set first, then borderWidth is set later.
    // borderWidth should reset/override borderLeftWidth.
    const result = flattenStyle([{ borderLeftWidth: 10 }, { borderWidth: 5 }])

    expect(result).toEqual({
      borderTopWidth: 5,
      borderRightWidth: 5,
      borderBottomWidth: 5,
      borderLeftWidth: 5,
    })
  })

  it('should handle specific overrides after shorthands', () => {
    const result = flattenStyle([{ margin: 10 }, { marginTop: 20 }])

    expect(result).toEqual({
      marginTop: 20,
      marginBottom: 10,
      marginLeft: 10,
      marginRight: 10,
    })
  })

  it('should expand axis shorthands (marginVertical)', () => {
    const result = flattenStyle({ marginVertical: 20 })
    expect(result).toEqual({
      marginTop: 20,
      marginBottom: 20,
    })
  })

  it('should expand logical shorthands (marginBlock)', () => {
    const result = flattenStyle({ marginBlock: 30 })
    expect(result).toEqual({
      marginBlockStart: 30,
      marginBlockEnd: 30,
    })
  })

  it('should expand inset shorthands', () => {
    const result = flattenStyle({ inset: 50 })
    expect(result).toEqual({
      top: 50,
      bottom: 50,
      left: 50,
      right: 50,
    })
  })

  it('should expand gap shorthands', () => {
    const result = flattenStyle({ gap: 10 })
    expect(result).toEqual({
      rowGap: 10,
      columnGap: 10,
    })
  })

  it('should expand borderColor shorthands', () => {
    const result = flattenStyle({ borderColor: 'red' })
    expect(result).toEqual({
      borderTopColor: 'red',
      borderRightColor: 'red',
      borderBottomColor: 'red',
      borderLeftColor: 'red',
    })
  })
})
