import type { FilmBatch, ShrinkCurvePoint } from './types.ts'

const now = () => Date.now()

// 典型收缩曲线：60℃ 起步，70~90℃ 为主收缩区，单位为分数
const petgTd: ShrinkCurvePoint[] = [
  { temp: 60, shrink: 0.02 },
  { temp: 70, shrink: 0.18 },
  { temp: 78, shrink: 0.42 },
  { temp: 85, shrink: 0.6 },
  { temp: 95, shrink: 0.72 },
  { temp: 105, shrink: 0.76 },
]
const petgMd: ShrinkCurvePoint[] = [
  { temp: 60, shrink: 0.01 },
  { temp: 70, shrink: 0.05 },
  { temp: 78, shrink: 0.1 },
  { temp: 85, shrink: 0.14 },
  { temp: 95, shrink: 0.17 },
  { temp: 105, shrink: 0.18 },
]

const pvcTd: ShrinkCurvePoint[] = [
  { temp: 60, shrink: 0.03 },
  { temp: 70, shrink: 0.22 },
  { temp: 80, shrink: 0.45 },
  { temp: 90, shrink: 0.58 },
  { temp: 100, shrink: 0.63 },
  { temp: 110, shrink: 0.65 },
]
const pvcMd: ShrinkCurvePoint[] = [
  { temp: 60, shrink: 0.02 },
  { temp: 70, shrink: 0.08 },
  { temp: 80, shrink: 0.14 },
  { temp: 90, shrink: 0.19 },
  { temp: 100, shrink: 0.22 },
  { temp: 110, shrink: 0.23 },
]

const opsTd: ShrinkCurvePoint[] = [
  { temp: 60, shrink: 0.01 },
  { temp: 70, shrink: 0.1 },
  { temp: 80, shrink: 0.28 },
  { temp: 90, shrink: 0.42 },
  { temp: 100, shrink: 0.5 },
  { temp: 110, shrink: 0.54 },
]
const opsMd: ShrinkCurvePoint[] = [
  { temp: 60, shrink: 0.01 },
  { temp: 70, shrink: 0.03 },
  { temp: 80, shrink: 0.06 },
  { temp: 90, shrink: 0.09 },
  { temp: 100, shrink: 0.11 },
  { temp: 110, shrink: 0.12 },
]

export function makeSampleFilms(): FilmBatch[] {
  return [
    {
      id: 'film-petg-a',
      material: 'PETG',
      name: 'PETG 40μm A 批',
      thicknessUm: 40,
      tdCurve: petgTd,
      mdCurve: petgMd,
      tdLimit: 0.74,
      updatedAt: now(),
    },
    {
      id: 'film-pvc-a',
      material: 'PVC',
      name: 'PVC 45μm A 批',
      thicknessUm: 45,
      tdCurve: pvcTd,
      mdCurve: pvcMd,
      tdLimit: 0.64,
      updatedAt: now(),
    },
    {
      id: 'film-ops-a',
      material: 'OPS',
      name: 'OPS 40μm A 批',
      thicknessUm: 40,
      tdCurve: opsTd,
      mdCurve: opsMd,
      tdLimit: 0.53,
      updatedAt: now(),
    },
  ]
}
