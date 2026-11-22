import { interp1 } from './geometry.ts'
import type { FilmBatch, ShrinkCurvePoint } from './types.ts'
import type { ShrinkSimulation } from './simulation.ts'

export interface DetectedPoint {
  x: number
  y: number
  strength: number
}

export interface DeviationCell {
  row: number
  col: number
  // 实测与仿真交点的平面距离 mm
  deviationMm: number
  // 局部实测横向应变偏差（正=实测收得更多）
  strainDelta: number
  z: number
}

export interface VerificationResult {
  detected: DetectedPoint[]
  matched: number
  cells: DeviationCell[]
  meanDeviationMm: number
  maxDeviationMm: number
  // 分区热力图（按高度分箱）
  heatBands: { z: number; meanDeviation: number; strainDelta: number }[]
  // 反修后的 TD 曲线
  correctedTdCurve: ShrinkCurvePoint[]
  correctionGain: number
}

// 自适应阈值 + 局部暗点检测找网格交点
export function detectGridIntersections(
  source: HTMLCanvasElement,
  cols: number,
  rows: number,
): DetectedPoint[] {
  const ctx = source.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('画布不可用')
  const { width, height } = source
  const data = ctx.getImageData(0, 0, width, height).data
  const gray = new Float32Array(width * height)
  let sum = 0
  for (let i = 0; i < gray.length; i++) {
    const v = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2]
    gray[i] = v
    sum += v
  }
  const mean = sum / gray.length
  const radius = Math.max(4, Math.round(Math.min(width / (cols + 2), height / (rows + 2)) * 0.45))
  const candidates: DetectedPoint[] = []

  for (let y = radius; y < height - radius; y += 2) {
    for (let x = radius; x < width - radius; x += 2) {
      const i = y * width + x
      if (gray[i] > mean - 25) continue
      // 邻域均值对比：交点比周围明显更暗
      let local = 0
      let count = 0
      for (let dy = -radius; dy <= radius; dy += 2) {
        for (let dx = -radius; dx <= radius; dx += 2) {
          local += gray[(y + dy) * width + (x + dx)]
          count++
        }
      }
      local /= count
      const strength = local - gray[i]
      if (strength > 35) candidates.push({ x, y, strength })
    }
  }

  // 非极大值抑制 + 网格拓扑排序
  candidates.sort((a, b) => b.strength - a.strength)
  const picked: DetectedPoint[] = []
  const minDist = radius * 1.4
  for (const c of candidates) {
    if (picked.every((p) => Math.hypot(p.x - c.x, p.y - c.y) > minDist)) {
      picked.push(c)
      if (picked.length >= (cols + 1) * (rows + 1) + 6) break
    }
  }
  return picked
}

// 把检测点与期望网格做最近邻匹配，逐格计算偏差
export function verifyAgainstSimulation(
  sim: ShrinkSimulation,
  detected: DetectedPoint[],
  cols: number,
  rows: number,
  photoWidthMm: number,
  photoWidthPx = 1024,
): VerificationResult {
  const expected: { x: number; y: number; row: number; col: number; z: number }[] = []
  const cells: DeviationCell[] = []
  for (let r = 0; r <= rows; r++) {
    const ny = r / rows
    const z = sim.zMin + ny * sim.initialHeight
    for (let c = 0; c <= cols; c++) {
      const nx = c / cols
      expected.push({
        x: nx * photoWidthMm,
        y: ny * sim.initialHeight,
        row: r,
        col: c,
        z,
      })
    }
  }

  // 图像像素 -> mm 的尺度（照片按标签幅面铺满估算）
  const pxToMm = photoWidthMm / photoWidthPx
  let total = 0
  let maxDev = 0
  for (const e of expected) {
    let best: DetectedPoint | null = null
    let bestDist = Infinity
    for (const d of detected) {
      const dx = (d.x * pxToMm - e.x)
      const dy = (d.y * pxToMm - e.y)
      const dist = Math.hypot(dx, dy)
      if (dist < bestDist) {
        bestDist = dist
        best = d
      }
    }
    if (!best || bestDist > 8) continue
    total++
    maxDev = Math.max(maxDev, bestDist)
    // 横向应变偏差：用 x 方向残差相对格宽估算
    const cellW = photoWidthMm / cols
    const strainDelta = (best.x * pxToMm - e.x) / cellW
    cells.push({ row: e.row, col: e.col, deviationMm: bestDist, strainDelta, z: e.z })
  }

  const meanDev = total ? cells.reduce((a, c) => a + c.deviationMm, 0) / total : 0

  // 按高度分箱热力图
  const bandCount = 10
  const heatBands = Array.from({ length: bandCount }, (_, b) => {
    const z0 = sim.zMin + (b / bandCount) * sim.initialHeight
    const z1 = sim.zMin + ((b + 1) / bandCount) * sim.initialHeight
    const inBand = cells.filter((c) => c.z >= z0 && c.z < z1)
    return {
      z: (z0 + z1) / 2,
      meanDeviation: inBand.length
        ? inBand.reduce((a, c) => a + c.deviationMm, 0) / inBand.length
        : 0,
      strainDelta: inBand.length
        ? inBand.reduce((a, c) => a + c.strainDelta, 0) / inBand.length
        : 0,
    }
  })

  const corrected = correctTdCurve(sim.film.tdCurve, heatBands)
  return {
    detected,
    matched: total,
    cells,
    meanDeviationMm: meanDev,
    maxDeviationMm: maxDev,
    heatBands,
    correctedTdCurve: corrected,
    correctionGain: 0.6,
  }
}

// 由分区应变偏差反修 TD 收缩曲线：
// 实测收得更多（strainDelta<0）-> 该温度区间平衡收缩率上调，带 0.6 增益防过冲
export function correctTdCurve(
  curve: ShrinkCurvePoint[],
  bands: { z: number; meanDeviation: number; strainDelta: number }[],
  gain = 0.6,
): ShrinkCurvePoint[] {
  const active = bands.filter((b) => b.meanDeviation > 0)
  if (!active.length) return curve.map((p) => ({ ...p }))
  const avgDelta = active.reduce((a, b) => a + b.strainDelta, 0) / active.length
  return curve.map((p) => {
    // 主收缩区（shrink 0.1~0.65）修正力度最大
    const weight = p.shrink > 0.08 && p.shrink < 0.68 ? 1 : 0.4
    const adjusted = p.shrink - avgDelta * gain * weight
    return {
      temp: p.temp,
      shrink: Math.min(0.85, Math.max(0.005, Number(adjusted.toFixed(4)))),
    }
  })
}

// 生成 z 相关的 TD 乘子场，供下一轮仿真直接注入
export function correctionMultiplier(
  film: FilmBatch,
  correctedCurve: ShrinkCurvePoint[],
): (z: number) => number {
  const xs = film.tdCurve.map((p) => p.temp)
  const oldYs = film.tdCurve.map((p) => p.shrink)
  const newYs = correctedCurve.map((p) => p.shrink)
  return (z: number) => {
    // 高度不直接对应温度，这里返回全局平均乘子；逐高度修正由热力带在页面层注入
    const refTemp = 85
    const oldV = interp1(xs, oldYs, refTemp)
    const newV = interp1(xs, newYs, refTemp)
    return oldV > 1e-6 ? 1 + (newV - oldV) : 1
  }
}
