import type { FilmBatch, FurnaceZone, ShrinkCurvePoint } from './types.ts'
import { interp1 } from './geometry.ts'

export interface KineticsState {
  // 当前已实现的自由收缩应变（分数），趋向当前温区平衡值
  tdStrain: number
  mdStrain: number
  // 累计受热时间
  time: number
  // 当前膜温
  temp: number
}

export function initKinetics(): KineticsState {
  return { tdStrain: 0, mdStrain: 0, time: 0, temp: 25 }
}

function curveXs(curve: ShrinkCurvePoint[]) {
  return curve.map((p) => p.temp)
}
function curveYs(curve: ShrinkCurvePoint[]) {
  return curve.map((p) => p.shrink)
}

// 当前温度下的平衡自由收缩率
export function equilibriumShrink(film: FilmBatch, temp: number, dir: 'td' | 'md') {
  const curve = dir === 'td' ? film.tdCurve : film.mdCurve
  return interp1(curveXs(curve), curveYs(curve), temp)
}

// 蒸汽换热系数高于热风，单位 1/s
export function zoneRate(zone: FurnaceZone): number {
  return zone.kind === 'steam' ? 1.1 : 0.75
}

// 一阶松弛模型：dε/dt = k(ε_eq(T) - ε)
// 返回 dt 后的新状态
export function stepKinetics(
  state: KineticsState,
  film: FilmBatch,
  zone: FurnaceZone,
  dt: number,
): KineticsState {
  const k = zoneRate(zone)
  const tdEq = equilibriumShrink(film, zone.temp, 'td')
  const mdEq = equilibriumShrink(film, zone.temp, 'md')
  const relax = 1 - Math.exp(-k * dt)
  // 膜温按集总热容向风温逼近，时间常数取 1.2s
  const temp = zone.temp - (zone.temp - state.temp) * Math.exp(-dt / 1.2)
  return {
    tdStrain: state.tdStrain + (tdEq - state.tdStrain) * relax,
    mdStrain: state.mdStrain + (mdEq - state.mdStrain) * relax,
    time: state.time + dt,
    temp,
  }
}

// 把整条炉程展开成等长子步序列
export interface SubStep {
  zoneId: string
  zoneName: string
  temp: number
  dt: number
  time: number
}

export function expandSubsteps(zones: FurnaceZone[], subDt = 0.2): SubStep[] {
  const out: SubStep[] = []
  let time = 0
  for (const zone of zones) {
    const n = Math.max(1, Math.round(zone.dwell / subDt))
    const dt = zone.dwell / n
    for (let i = 0; i < n; i++) {
      time += dt
      out.push({ zoneId: zone.id, zoneName: zone.name, temp: zone.temp, dt, time })
    }
  }
  return out
}
