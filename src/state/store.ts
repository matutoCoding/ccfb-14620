import { reactive } from 'vue'
import type {
  Artwork,
  BottleProfile,
  FilmBatch,
  FurnaceProfile,
  ShrinkCurvePoint,
} from '@/core/types'
import type { ShrinkSimulation } from '@/core/simulation'
import type { VerificationResult } from '@/core/verification'

// 全局工作上下文：当前选用的瓶型/膜材/炉/稿件与仿真结果
interface WorkbenchState {
  bottle: BottleProfile | null
  film: FilmBatch | null
  furnace: FurnaceProfile | null
  artwork: Artwork | null
  simulation: ShrinkSimulation | null
  verification: VerificationResult | null
  // 生效中的 TD 修正曲线（null 表示用膜材原始曲线）
  correctedTdCurve: ShrinkCurvePoint[] | null
  correctionRound: number
  renderOptions: {
    liquidColor: [number, number, number]
    liquidLevel: number
    glass: number
    gloss: number
    whiteUnder: number
    showDefects: boolean
    showWire: boolean
  }
}

export const store = reactive<WorkbenchState>({
  bottle: null,
  film: null,
  furnace: null,
  artwork: null,
  simulation: null,
  verification: null,
  correctedTdCurve: null,
  correctionRound: 0,
  renderOptions: {
    liquidColor: [0.92, 0.55, 0.25],
    liquidLevel: 90,
    glass: 0.35,
    gloss: 0.7,
    whiteUnder: 0.9,
    showDefects: true,
    showWire: false,
  },
})

export function resetCorrection() {
  store.correctedTdCurve = null
  store.correctionRound = 0
  store.verification = null
}
