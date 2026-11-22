import type { CodeRegion, RigidRegion } from './types.ts'
import { interp1 } from './geometry.ts'
import type { ShrinkSimulation } from './simulation.ts'
import { invertField, type WarpField } from './warp_field.ts'

export interface WarpRenderOptions {
  outDpi?: number
  rigidRegions: RigidRegion[]
  showGrid?: boolean
  onProgress?: (ratio: number) => void
}

const nextFrame = () => new Promise((r) => setTimeout(r, 0))

// 逐像素逆采样渲染预变形稿：输出画布上每个材料像素 -> 回原稿采样
// 分块异步执行，避免大画幅阻塞主线程
export async function renderWarpedArtwork(
  source: HTMLImageElement | HTMLCanvasElement,
  field: WarpField,
  opts: WarpRenderOptions,
): Promise<HTMLCanvasElement> {
  const { widthMm, heightMm } = field
  const dpi = opts.outDpi ?? 300
  const pxPerMm = dpi / 25.4
  const w = Math.round(widthMm * pxPerMm)
  const h = Math.round(heightMm * pxPerMm)
  const out = document.createElement('canvas')
  out.width = w
  out.height = h
  const ctx = out.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('画布 2D 上下文不可用')
  const srcCanvas = normalizeSource(source)
  const sctx = srcCanvas.getContext('2d', { willReadFrequently: true })
  if (!sctx) throw new Error('源稿画布不可用')
  const srcData = sctx.getImageData(0, 0, srcCanvas.width, srcCanvas.height)
  const img = ctx.createImageData(w, h)

  const rigid = opts.rigidRegions.map((r) => ({
    x0: r.x * widthMm,
    y0: r.y * heightMm,
    x1: (r.x + r.w) * widthMm,
    y1: (r.y + r.h) * heightMm,
  }))

  const bandSize = Math.max(8, Math.floor(h / 12))
  for (let yb = 0; yb < h; yb += bandSize) {
    const yEnd = Math.min(h, yb + bandSize)
    for (let y = yb; y < yEnd; y++) {
      const my = (y / h) * heightMm
      for (let x = 0; x < w; x++) {
        const mx = (x / w) * widthMm
        const sample = invertField(field, mx, my)
        let px = sample.px
        let py = sample.py
        // 刚性区：用区域中心的位移做整体相似平移，区域内部不发生局部形变
        for (const r of rigid) {
          if (mx >= r.x0 && mx <= r.x1 && my >= r.y0 && my >= r.y1) {
            const cx = (r.x0 + r.x1) / 2
            const cy = (r.y0 + r.y1) / 2
            const center = invertField(field, cx, cy)
            px = mx + (center.px - cx)
            py = my + (center.py - cy)
            break
          }
        }
        const sx = Math.round((px / widthMm) * srcCanvas.width)
        const sy = Math.round((py / heightMm) * srcCanvas.height)
        const o = (y * w + x) * 4
        if (sx < 0 || sy < 0 || sx >= srcCanvas.width || sy >= srcCanvas.height) {
          img.data[o + 3] = 0
          continue
        }
        const si = (sy * srcCanvas.width + sx) * 4
        img.data[o] = srcData.data[si]
        img.data[o + 1] = srcData.data[si + 1]
        img.data[o + 2] = srcData.data[si + 2]
        img.data[o + 3] = srcData.data[si + 3]
      }
    }
    opts.onProgress?.(yEnd / h)
    await nextFrame()
  }
  ctx.putImageData(img, 0, 0)

  if (opts.showGrid) {
    ctx.strokeStyle = 'rgba(14,116,144,0.55)'
    ctx.lineWidth = 1
    const cols = 24
    const rows = 16
    for (let r = 0; r <= rows; r++) {
      ctx.beginPath()
      for (let c = 0; c <= cols; c++) {
        const s = invertField(field, (c / cols) * widthMm, (r / rows) * heightMm)
        const gx = (s.mx / widthMm) * w
        const gy = (s.my / heightMm) * h
        if (c === 0) ctx.moveTo(gx, gy)
        else ctx.lineTo(gx, gy)
      }
      ctx.stroke()
    }
    for (let c = 0; c <= cols; c++) {
      ctx.beginPath()
      for (let r = 0; r <= rows; r++) {
        const s = invertField(field, (c / cols) * widthMm, (r / rows) * heightMm)
        const gx = (s.mx / widthMm) * w
        const gy = (s.my / heightMm) * h
        if (r === 0) ctx.moveTo(gx, gy)
        else ctx.lineTo(gx, gy)
      }
      ctx.stroke()
    }
  }
  return out
}

function normalizeSource(source: HTMLImageElement | HTMLCanvasElement): HTMLCanvasElement {
  if (source instanceof HTMLCanvasElement) return source
  const c = document.createElement('canvas')
  c.width = source.naturalWidth
  c.height = source.naturalHeight
  const ctx = c.getContext('2d')
  if (!ctx) throw new Error('源稿画布不可用')
  ctx.drawImage(source, 0, 0)
  return c
}

export interface CodeGrade {
  region: CodeRegion
  // 平均模块宽窄比误差（分数）
  widthError: number
  // 最差高度带
  worstZ: number
  worstError: number
  grade: 'A' | 'B' | 'C' | 'F'
  scannable: boolean
  // 逐高度带的误差，用于定位失败高度
  bands: { z: number; error: number }[]
}

// 条码/二维码评级：收缩后各高度带的环向缩放不一致 -> 模块宽窄比误差
export function gradeCodeRegion(sim: ShrinkSimulation, region: CodeRegion): CodeGrade {
  const { geo, initialCircumference } = sim
  const bands: { z: number; error: number }[] = []
  const z0 = sim.zMin + region.y * sim.initialHeight
  const z1 = sim.zMin + (region.y + region.h) * sim.initialHeight
  const steps = 12
  for (let k = 0; k <= steps; k++) {
    const z = z0 + ((z1 - z0) * k) / steps
    const perim = interp1(geo.zs, geo.perimeters, z)
    // 该高度局部环向应变：材料被压缩到瓶面的比例
    const localShrink = 1 - perim / initialCircumference
    // 预变形已按全局场补偿，残余误差来自高度带之间的不均匀度
    const midPerim = interp1(geo.zs, geo.perimeters, (z0 + z1) / 2)
    const error = Math.abs(perim / midPerim - 1) + Math.max(0, localShrink - sim.film.tdLimit) * 0.5
    bands.push({ z, error })
  }
  const widthError = bands.reduce((a, b) => a + b.error, 0) / bands.length
  const worst = bands.reduce((a, b) => (b.error > a.error ? b : a))
  const grade: CodeGrade['grade'] =
    widthError <= 0.02 ? 'A' : widthError <= 0.035 ? 'B' : widthError <= 0.05 ? 'C' : 'F'
  return {
    region,
    widthError,
    worstZ: worst.z,
    worstError: worst.error,
    grade,
    scannable: widthError <= 0.05,
    bands,
  }
}

// 条码逐列补偿：返回每列在印刷稿上应有的横向缩放，保证收缩后等宽
export function barcodeColumnCompensation(
  sim: ShrinkSimulation,
  region: CodeRegion,
  moduleCount: number,
): number[] {
  const { geo, initialCircumference } = sim
  const z = sim.zMin + (region.y + region.h / 2) * sim.initialHeight
  const perim = interp1(geo.zs, geo.perimeters, z)
  const localScale = perim / initialCircumference
  // 印刷时反向放大：收后才能等宽
  const base = 1 / Math.max(localScale, 0.01)
  return Array.from({ length: moduleCount }, () => base)
}
