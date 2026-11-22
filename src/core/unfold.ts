import { invertField, type WarpField } from './warp_field.ts'

// 展开视图：把收缩后瓶面位置映射回二维平面，与原稿并排/叠加对照
export function renderUnfolded(
  field: WarpField,
  source: HTMLImageElement | HTMLCanvasElement,
): HTMLCanvasElement {
  const { widthMm, heightMm } = field
  const scale = 3
  const w = Math.round(widthMm * scale)
  const h = Math.round(heightMm * scale)
  const out = document.createElement('canvas')
  out.width = w
  out.height = h
  const ctx = out.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('画布不可用')
  const src = source instanceof HTMLCanvasElement ? source : (() => {
    const c = document.createElement('canvas')
    c.width = source.naturalWidth
    c.height = source.naturalHeight
    c.getContext('2d')?.drawImage(source, 0, 0)
    return c
  })()
  const sctx = src.getContext('2d', { willReadFrequently: true })
  if (!sctx) throw new Error('源稿不可读')
  const data = sctx.getImageData(0, 0, src.width, src.height)
  const img = ctx.createImageData(w, h)

  for (let y = 0; y < h; y++) {
    const my = (y / h) * heightMm
    for (let x = 0; x < w; x++) {
      const mx = (x / w) * widthMm
      const s = invertField(field, mx, my)
      const sx = Math.round((s.px / widthMm) * src.width)
      const sy = Math.round((s.py / heightMm) * src.height)
      const o = (y * w + x) * 4
      if (sx < 0 || sy < 0 || sx >= src.width || sy >= src.height) {
        img.data[o + 3] = 0
        continue
      }
      const si = (sy * src.width + sx) * 4
      img.data[o] = data.data[si]
      img.data[o + 1] = data.data[si + 1]
      img.data[o + 2] = data.data[si + 2]
      img.data[o + 3] = data.data[si + 3]
    }
  }
  ctx.putImageData(img, 0, 0)
  return out
}

// 原稿与收缩稿叠加偏差图：半透明红青错位
export function renderOverlay(
  original: HTMLImageElement | HTMLCanvasElement,
  unfolded: HTMLCanvasElement,
): HTMLCanvasElement {
  const w = unfolded.width
  const h = unfolded.height
  const out = document.createElement('canvas')
  out.width = w
  out.height = h
  const ctx = out.getContext('2d')
  if (!ctx) throw new Error('画布不可用')
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, w, h)
  ctx.globalAlpha = 0.55
  ctx.drawImage(original, 0, 0, w, h)
  ctx.globalCompositeOperation = 'multiply'
  ctx.globalAlpha = 0.7
  ctx.drawImage(unfolded, 0, 0, w, h)
  ctx.globalCompositeOperation = 'source-over'
  ctx.globalAlpha = 1
  return out
}
