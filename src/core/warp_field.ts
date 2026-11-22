import { interp1 } from './geometry.ts'
import type { ShrinkSimulation, SimNode } from './simulation.ts'

export interface WarpSample {
  // 印刷稿坐标 mm
  px: number
  py: number
  // 预变形后应放置的膜材料坐标 mm
  mx: number
  my: number
}

export interface WarpField {
  sim: ShrinkSimulation
  // 与材料网格同分辨率的前向映射：print(s,m) -> 瓶面位置
  widthMm: number
  heightMm: number
  // 每个材料网格点对应的印刷材料弧长/纵向位置
  printS: Float32Array
  printM: Float32Array
}

function nodeAt(sim: ShrinkSimulation, i: number, j: number): SimNode {
  return sim.nodes[j * sim.nU + ((i + sim.nU) % sim.nU)]
}

// 构建前向映射：材料坐标 (s,m) 对应的原始印刷稿位置
// 已钉扎节点：printS 按相邻钉扎点的瓶面弧长重分布
// 自由节点：保持初始材料等间距
export function buildWarpField(
  sim: ShrinkSimulation,
  widthMm: number,
  heightMm: number,
): WarpField {
  const { nU, nV, initialCircumference, initialHeight } = sim
  const printS = new Float32Array((nV + 1) * nU)
  const printM = new Float32Array((nV + 1) * nU)

  for (let j = 0; j <= nV; j++) {
    const ring: SimNode[] = []
    for (let i = 0; i < nU; i++) ring.push(nodeAt(sim, i, j))
    const pinnedIdx = ring.map((n, i) => (n.flag === 'pinned' || n.flag === 'wrinkle' ? i : -1)).filter((i) => i >= 0)

    if (pinnedIdx.length >= 2) {
      // 瓶面弧长累积，作为印刷弧长坐标
      const arc = new Array<number>(nU).fill(0)
      for (let k = 1; k < nU; k++) {
        const a = ring[k - 1]
        const b = ring[k]
        arc[k] = arc[k - 1] + Math.hypot(b.x - a.x, b.y - a.y)
      }
      const firstPin = pinnedIdx[0]
      const base = arc[firstPin] - ring[firstPin].s
      for (let i = 0; i < nU; i++) {
        printS[j * nU + i] = arc[i] - base
      }
    } else {
      for (let i = 0; i < nU; i++) {
        printS[j * nU + i] = ring[i].s
      }
    }

    // 纵向：钉扎节点直接取其 pin 时的材料高，自由节点插值
    const pinnedRows: { j: number; m: number }[] = []
    for (let jj = 0; jj <= nV; jj++) {
      const sample = nodeAt(sim, 0, jj)
      if (sample.flag === 'pinned' || sample.flag === 'wrinkle') {
        pinnedRows.push({ j: jj, m: sample.m })
      }
    }
    const rows = pinnedRows.length >= 2 ? pinnedRows : [{ j: 0, m: 0 }, { j: nV, m: initialHeight }]
    const mNow = (j / nV) * initialHeight
    printM[j * nU] = interp1(
      rows.map((r) => r.j),
      rows.map((r) => r.m),
      (mNow / initialHeight) * nV,
    )
    for (let i = 1; i < nU; i++) printM[j * nU + i] = printM[j * nU]
  }

  // 归一化到印刷稿尺寸
  const sScale = widthMm / initialCircumference
  const mScale = heightMm / initialHeight
  for (let k = 0; k < printS.length; k++) {
    printS[k] *= sScale
    printM[k] *= mScale
  }
  return { sim, widthMm, heightMm, printS, printM }
}

// 双线性查表：给定材料坐标 (mx,my)，返回印刷稿上应采样的 (px,py)
export function invertField(field: WarpField, mx: number, my: number): WarpSample {
  const { sim, printS, printM, widthMm, heightMm } = field
  const { nU, nV, initialCircumference, initialHeight } = sim
  const s = (mx / widthMm) * initialCircumference
  const m = (my / heightMm) * initialHeight
  const fi = (m / initialHeight) * nV
  const j0 = Math.max(0, Math.min(nV - 1, Math.floor(fi)))
  const jt = fi - j0
  const u = ((s % initialCircumference) + initialCircumference) % initialCircumference
  const kf = (u / initialCircumference) * nU
  const i0 = Math.floor(kf) % nU
  const i1 = (i0 + 1) % nU
  const it = kf - Math.floor(kf)

  const sample = (i: number, j: number) => {
    const k = j * nU + i
    return { ps: printS[k], pm: printM[k] }
  }
  const a = sample(i0, j0)
  const b = sample(i1, j0)
  const c = sample(i0, j0 + 1)
  const d = sample(i1, j0 + 1)
  const px = (1 - jt) * (a.ps + (b.ps - a.ps) * it) + jt * (c.ps + (d.ps - c.ps) * it)
  const py = (1 - jt) * (a.pm + (b.pm - a.pm) * it) + jt * (c.pm + (d.pm - c.pm) * it)
  return { px, py, mx, my }
}

// 导出结构化变形网格，供页面叠加显示
export function warpGridLines(field: WarpField, cols = 24, rows = 16): WarpSample[][] {
  const lines: WarpSample[][] = []
  for (let r = 0; r <= rows; r++) {
    const line: WarpSample[] = []
    const my = (r / rows) * field.heightMm
    for (let c = 0; c <= cols; c++) {
      const mx = (c / cols) * field.widthMm
      line.push(invertField(field, mx, my))
    }
    lines.push(line)
  }
  return lines
}
