import type { Artwork, CodeRegion, RigidRegion } from './types.ts'
import { uid } from '@/db/indexeddb.ts'

// 生成一张带 logo、文字、条码、网格的示例平面稿（纯 Canvas，无外部素材）
export function generateSampleArtwork(widthMm = 210, heightMm = 150, dpi = 150): HTMLCanvasElement {
  const px = (mm: number) => Math.round((mm * dpi) / 25.4)
  const canvas = document.createElement('canvas')
  canvas.width = px(widthMm)
  canvas.height = px(heightMm)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('画布不可用')

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  // 底纹：浅灰斜纹，允许大变形
  ctx.strokeStyle = '#e2e8f0'
  ctx.lineWidth = 2
  for (let x = -canvas.height; x < canvas.width; x += 28) {
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x + canvas.height, canvas.height)
    ctx.stroke()
  }

  // 刚性 logo 区
  const lx = px(20)
  const ly = px(18)
  const lw = px(58)
  const lh = px(30)
  ctx.fillStyle = '#0e7490'
  ctx.beginPath()
  ctx.arc(lx + lh / 2, ly + lh / 2, lh / 2 - 4, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#ffffff'
  ctx.font = `600 ${px(11)}px sans-serif`
  ctx.textBaseline = 'middle'
  ctx.fillText('AQUA', lx + lh, ly + lh / 2)

  // 主标题文字（刚性）
  ctx.fillStyle = '#0f172a'
  ctx.font = `600 ${px(9)}px sans-serif`
  ctx.fillText('PURE SPRING WATER', px(20), px(62))
  ctx.font = `400 ${px(5)}px sans-serif`
  ctx.fillStyle = '#475569'
  ctx.fillText('Natural mineral · 500ml', px(20), px(72))

  // 条码
  drawBarcode(ctx, px(20), px(95), px(70), px(34))
  // 二维码占位
  drawQrPlaceholder(ctx, px(120), px(95), px(30))

  // 装饰色带
  ctx.fillStyle = '#155e75'
  ctx.fillRect(0, px(138), canvas.width, px(12))
  ctx.fillStyle = '#67e8f9'
  ctx.fillRect(0, px(134), canvas.width, px(4))

  return canvas
}

function drawBarcode(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(x - 6, y - 6, w + 12, h + 22)
  ctx.fillStyle = '#0f172a'
  const modules = 48
  const mw = w / modules
  let rng = 7
  for (let i = 0; i < modules; i++) {
    rng = (rng * 1103515245 + 12345) & 0x7fffffff
    if (rng % 3 !== 0) {
      ctx.fillRect(x + i * mw, y, mw * (rng % 2 === 0 ? 1.4 : 0.8), h)
    }
  }
}

function drawQrPlaceholder(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(x - 4, y - 4, size + 8, size + 8)
  ctx.fillStyle = '#0f172a'
  const cells = 15
  const c = size / cells
  let rng = 21
  for (let r = 0; r < cells; r++) {
    for (let q = 0; q < cells; q++) {
      rng = (rng * 1664525 + 1013904223) & 0x7fffffff
      if (rng % 2 === 0) ctx.fillRect(x + q * c, y + r * c, c * 0.9, c * 0.9)
    }
  }
}

export function makeArtworkMeta(canvas: HTMLCanvasElement, name: string, widthMm: number, heightMm: number): Artwork {
  const rigid: RigidRegion[] = [
    { id: uid('rig'), name: 'Logo', x: 0.08, y: 0.1, w: 0.3, h: 0.22 },
    { id: uid('rig'), name: '主标题', x: 0.08, y: 0.38, w: 0.42, h: 0.12 },
  ]
  const codes: CodeRegion[] = [
    { id: uid('code'), name: '商品条码', kind: 'barcode', x: 0.08, y: 0.62, w: 0.36, h: 0.24 },
    { id: uid('code'), name: '溯源二维码', kind: 'qrcode', x: 0.57, y: 0.62, w: 0.16, h: 0.22 },
  ]
  return {
    id: uid('art'),
    name,
    widthMm,
    heightMm,
    imageDataUrl: canvas.toDataURL('image/png'),
    whiteUnderprint: true,
    clearWindows: [],
    rigidRegions: rigid,
    codeRegions: codes,
    overlapMm: 8,
    updatedAt: Date.now(),
  }
}

export function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = dataUrl
  })
}
