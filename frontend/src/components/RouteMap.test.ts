import { Cartographic, Math as CesiumMath } from 'cesium'
import { describe, expect, it } from 'vitest'
import { simulatedAirPositions } from './RouteMap'

describe('simulated air display path', () => {
  it('adds a climb and descent without changing the supplied corridor endpoints', () => {
    const corridor: [number, number][] = [[117.169, 39.111], [117.174, 39.113]]
    const positions = simulatedAirPositions(corridor)
    const start = Cartographic.fromCartesian(positions[0])
    const cruise = Cartographic.fromCartesian(positions[16])
    const end = Cartographic.fromCartesian(positions.at(-1)!)

    expect(positions).toHaveLength(33)
    expect(CesiumMath.toDegrees(start.longitude)).toBeCloseTo(corridor[0][0], 5)
    expect(CesiumMath.toDegrees(start.latitude)).toBeCloseTo(corridor[0][1], 5)
    expect(start.height).toBeCloseTo(0, 2)
    expect(cruise.height).toBeCloseTo(800, 2)
    expect(CesiumMath.toDegrees(end.longitude)).toBeCloseTo(corridor[1][0], 5)
    expect(CesiumMath.toDegrees(end.latitude)).toBeCloseTo(corridor[1][1], 5)
    expect(end.height).toBeCloseTo(0, 2)
    expect(corridor).toEqual([[117.169, 39.111], [117.174, 39.113]])
  })

  it('does not invent an air path from coincident coordinates', () => {
    expect(simulatedAirPositions([[114, 22], [114, 22]])).toEqual([])
  })
})
