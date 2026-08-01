import { describe, expect, it } from 'vitest'
import { hash01, noiseWalk, pick, randInt, sample, uid } from '@/utils/random'

describe('random', () => {
  it('noiseWalk moves toward target within step bounds', () => {
    expect(noiseWalk(50, 50, 1)).toBe(50)
    expect(noiseWalk(50, 52, 1)).toBe(51)
    expect(noiseWalk(50, 48, 1)).toBe(49)
    expect(noiseWalk(50, 90, 1)).toBe(51)
  })

  it('randInt stays in inclusive range', () => {
    for (let i = 0; i < 200; i += 1) {
      const v = randInt(3, 7)
      expect(v).toBeGreaterThanOrEqual(3)
      expect(v).toBeLessThanOrEqual(7)
    }
  })

  it('pick returns an element of the array', () => {
    const arr = ['a', 'b', 'c']
    for (let i = 0; i < 50; i += 1) {
      expect(arr).toContain(pick(arr))
    }
  })

  it('sample returns unique elements of requested size', () => {
    const arr = [1, 2, 3, 4, 5]
    expect(sample(arr, 3).length).toBe(3)
    expect(sample(arr, 10).length).toBe(5)
  })

  it('uid produces prefixed unique ids', () => {
    const a = uid('x')
    const b = uid('x')
    expect(a).toMatch(/^x-/)
    expect(a).not.toBe(b)
  })

  it('hash01 is deterministic and in [0,1]', () => {
    expect(hash01('starc')).toBe(hash01('starc'))
    expect(hash01('starc')).toBeGreaterThanOrEqual(0)
    expect(hash01('starc')).toBeLessThanOrEqual(1)
  })
})
