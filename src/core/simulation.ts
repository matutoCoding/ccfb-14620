import type { BottleGeometry, FilmBatch, FurnaceProfile } from './types.ts'
import { interp1 } from './geometry.ts'
import { expandSubsteps, initKinetics, stepKinetics } from './kinetics.ts'

export type NodeFlag = 'free' | 'pinned' | 'wrinkle' | 'void'

export interface SimNode {
  // 材料坐标：环向弧长 s(mm)，材料初始高度 m(mm)
  s: number
  m: number
  // 当前世界坐标
  x: number
  y: number
  z: number
  flag: NodeFlag
  // 钉扎高度（接触瓶面时的 z），未钉扎为 -1
  pinnedZ: number
}

export interface SimFrame {
  time: number
  temp: number
  tdStrain: number
  mdStrain: number
  pinnedRatio: number
  positions: Float32Array
  flags: NodeFlag[]
}

export interface DefectMark {
  kind: 'wrinkle' | 'void'
  ring: number
  col: number
  z: number
  // 起皱：材料盈余率；空鼓：桥接间隙 mm
  magnitude: number
}

export interface ShrinkSimulation {
  geo: BottleGeometry
  film: FilmBatch
  furnace: FurnaceProfile
  nU: number
  nV: number
  initialCircumference: number
  initialHeight: number
  zMin: number
  zMax: number
  nodes: SimNode[]
  frames: SimFrame[]
  defects: DefectMark[]
  finalPinnedRatio: number
}

export interface SimOptions {
  nU?: number
  nV?: number
  // 修正后的曲线偏移（核对闭环用），作用于收缩率乘子
  tdCorrection?: (z: number) => number
}

// 高度 z 处的瓶面点：s 为从参考母线起算的截面弧长
export function surfaceAt(geo: BottleGeometry, z: number, s: number) {
  const fi = interp1(geo.zs, geo.zs.map((_, i) => i), z)
  const i0 = Math.floor(fi)
  const i1 = Math.min(i0 + 1, geo.zs.length - 1)
  const t = fi - i0
  const perim = interp1(geo.zs, geo.perimeters, z)
  const u = (((s % perim) + perim) % perim) / perim
  const kf = u * geo.sections[0].length
  const k0 = Math.floor(kf)
  const n = geo.sections[0].length
  const k1 = (k0 + 1) % n
  const kt = kf - k0
  const p00 = geo.sections[i0][k0]
  const p01 = geo.sections[i0][k1]
  const p10 = geo.sections[i1][k0]
  const p11 = geo.sections[i1][k1]
  return {
    x: (1 - t) * (p00.x + (p01.x - p00.x) * kt) + t * (p10.x + (p11.x - p10.x) * kt),
    y: (1 - t) * (p00.y + (p01.y - p00.y) * kt) + t * (p10.y + (p11.y - p10.y) * kt),
    radius: interp1(geo.zs, geo.perimeters, z) / (2 * Math.PI),
  }
}

function bottleRadiusAt(geo: BottleGeometry, z: number) {
  return interp1(geo.zs, geo.perimeters, z) / (2 * Math.PI)
}

export function runShrinkSimulation(
  geo: BottleGeometry,
  film: FilmBatch,
  furnace: FurnaceProfile,
  opts: SimOptions = {},
): ShrinkSimulation {
  const nU = opts.nU ?? 128
  const nV = opts.nV ?? 80
  const prof = geo.profile
  const zMin = prof.labelZMin
  const zMax = prof.labelZMax
  const initialHeight = zMax - zMin
  const initialCircumference = geo.maxPerimeter
  const r0 = initialCircumference / (2 * Math.PI)
  const correction = opts.tdCorrection ?? (() => 1)

  // 初始化套筒网格：套在最大周长之外的圆柱筒上
  const nodes: SimNode[] = []
  for (let j = 0; j <= nV; j++) {
    const m = (j / nV) * initialHeight
    for (let i = 0; i < nU; i++) {
      const s = (i / nU) * initialCircumference
      const theta = (i / nU) * Math.PI * 2
      nodes.push({
        s,
        m,
        x: r0 * Math.cos(theta),
        y: r0 * Math.sin(theta),
        z: zMin + m,
        flag: 'free',
        pinnedZ: -1,
      })
    }
  }
  const idx = (i: number, j: number) => j * nU + (i + nU) % nU

  const substeps = expandSubsteps(furnace.zones)
  const frames: SimFrame[] = []
  const defects: DefectMark[] = []
  let kin = initKinetics()

  const snapshot = (pinnedRatio: number): SimFrame => ({
    time: kin.time,
    temp: kin.temp,
    tdStrain: kin.tdStrain,
    mdStrain: kin.mdStrain,
    pinnedRatio,
    positions: new Float32Array(nodes.map((n) => [n.x, n.y, n.z]).flat()),
    flags: nodes.map((n) => n.flag),
  })
  frames.push(snapshot(0))

  for (const step of substeps) {
    const zone = furnace.zones.find((z) => z.id === step.zoneId)
    if (!zone) continue
    kin = stepKinetics(kin, film, zone, step.dt)
    const freeFactor = 1 - kin.tdStrain
    const mdFactor = 1 - kin.mdStrain

    // 自由节点按全局收缩因子收缩；已钉扎节点保持在瓶面
    for (let j = 0; j <= nV; j++) {
      for (let i = 0; i < nU; i++) {
        const n = nodes[idx(i, j)]
        if (n.flag === 'pinned') continue
        const zTarget = zMin + n.m * mdFactor
        const rTarget = r0 * freeFactor * correction(zTarget)
        const theta = (i / nU) * Math.PI * 2
        n.x = rTarget * Math.cos(theta)
        n.y = rTarget * Math.sin(theta)
        n.z = zTarget
      }
    }

    // 松弛两轮：自由节点 z 向相邻钉扎节点的瓶面斜率靠拢，模拟膜张力重分布
    for (let pass = 0; pass < 2; pass++) {
      for (let j = 1; j < nV; j++) {
        for (let i = 0; i < nU; i++) {
          const n = nodes[idx(i, j)]
          if (n.flag === 'pinned') continue
          const below = nodes[idx(i, j - 1)]
          const above = nodes[idx(i, j + 1)]
          const pinnedNeighbors =
            (below.flag === 'pinned' ? 1 : 0) + (above.flag === 'pinned' ? 1 : 0)
          if (pinnedNeighbors === 0) continue
          let zAcc = 0
          if (below.flag === 'pinned') zAcc += below.z + (n.m - below.m) * mdFactor
          if (above.flag === 'pinned') zAcc += above.z - (above.m - n.m) * mdFactor
          n.z = zAcc / pinnedNeighbors
          const theta = (i / nU) * Math.PI * 2
          const rTarget = r0 * freeFactor * correction(n.z)
          n.x = rTarget * Math.cos(theta)
          n.y = rTarget * Math.sin(theta)
        }
      }
    }

    // 接触判定：自由节点半径进入瓶面半径即钉扎
    for (let j = 0; j <= nV; j++) {
      for (let i = 0; i < nU; i++) {
        const n = nodes[idx(i, j)]
        if (n.flag === 'pinned') continue
        const rb = bottleRadiusAt(geo, n.z)
        const rNow = Math.hypot(n.x, n.y)
        if (rNow <= rb * 1.002) {
          const p = surfaceAt(geo, n.z, n.s)
          n.x = p.x
          n.y = p.y
          n.flag = 'pinned'
          n.pinnedZ = n.z
        }
      }
    }

    // 缺陷检测：逐环统计钉扎率与材料盈余
    for (let j = 0; j <= nV; j++) {
      let pinned = 0
      const ringPerim = interp1(geo.zs, geo.perimeters, zMin + (j / nV) * initialHeight)
      for (let i = 0; i < nU; i++) if (nodes[idx(i, j)].flag === 'pinned') pinned++
      const ratio = pinned / nU
      const materialPerim = initialCircumference * freeFactor
      const excess = materialPerim / ringPerim - 1
      if (ratio >= 0.7 && excess > 0.02) {
        for (let i = 0; i < nU; i++) {
          const n = nodes[idx(i, j)]
          if (n.flag === 'free') {
            n.flag = 'void'
            if (passUnmarked(defects, j, i)) {
              const gap = Math.hypot(n.x, n.y) - ringPerim / (2 * Math.PI)
              defects.push({ kind: 'void', ring: j, col: i, z: n.z, magnitude: Math.max(0, gap) })
            }
          }
        }
      }
      if (ratio >= 0.95 && excess > 0.03) {
        for (let i = 0; i < nU; i++) {
          const n = nodes[idx(i, j)]
          if (n.flag === 'pinned' && passUnmarkedWrinkle(defects, j)) {
            n.flag = 'wrinkle'
            defects.push({ kind: 'wrinkle', ring: j, col: i, z: n.z, magnitude: excess })
          }
        }
      }
    }

    const pinnedCount = nodes.filter((n) => n.flag === 'pinned' || n.flag === 'wrinkle').length
    frames.push(snapshot(pinnedCount / nodes.length))
  }

  const finalPinned = nodes.filter((n) => n.flag !== 'free' && n.flag !== 'void').length
  return {
    geo,
    film,
    furnace,
    nU,
    nV,
    initialCircumference,
    initialHeight,
    zMin,
    zMax,
    nodes,
    frames,
    defects,
    finalPinnedRatio: finalPinned / nodes.length,
  }
}

function passUnmarked(defects: DefectMark[], ring: number, col: number) {
  return !defects.some((d) => d.ring === ring && d.col === col)
}
function passUnmarkedWrinkle(defects: DefectMark[], ring: number) {
  return !defects.some((d) => d.ring === ring && d.kind === 'wrinkle')
}
