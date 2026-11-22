// 合成网格试标收缩后的实拍照片：透视 + 桶形畸变 + 噪声 + 模糊 + 亮度不均
export interface SyntheticPhotoOptions {
  width?: number
  height?: number
  cols?: number
  rows?: number
  // 透视强度 0~0.35
  perspective?: number
  // 桶形畸变 0~0.2
  barrel?: number
  noise?: number
  blur?: number
  // 可选：真实偏差场（mm），模拟实测与仿真的系统性偏差
  strainBias?: number
  seed?: number
}

// 可种子化随机，保证自测可复现
export function makeRng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

export interface SyntheticPhoto {
  canvas: HTMLCanvasElement
  // 合成时使用的真值交点，供检测算法对照
  truth: { x: number; y: number }[]
  cols: number
  rows: number
}

export function generateGridPhoto(opts: SyntheticPhotoOptions = {}): SyntheticPhoto {
  const width = opts.width ?? 1024
  const height = opts.height ?? 768
  const cols = opts.cols ?? 16
  const rows = opts.rows ?? 12
  const perspective = opts.perspective ?? 0.18
  const barrel = opts.barrel ?? 0.08
  const noise = opts.noise ?? 18
  const blur = opts.blur ?? 0.8
  const bias = opts.strainBias ?? 0
  const rng = makeRng(opts.seed ?? 42)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('画布不可用')

  // 暖色纸面底色
  const grad = ctx.createLinearGradient(0, 0, width, height)
  grad.addColorStop(0, '#f3ede2')
  grad.addColorStop(1, '#e6dccb')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, width, height)

  const marginX = width * 0.09
  const marginY = height * 0.1
  const truth: { x: number; y: number }[] = []

  const project = (nx: number, ny: number) => {
    // 透视：远处（画面上方）收窄
    const persp = 1 - perspective * (1 - ny)
    let x = width / 2 + (nx - 0.5) * (width - 2 * marginX) * persp
    let y = marginY + ny * (height - 2 * marginY)
    // 桶形畸变
    const dx = (x - width / 2) / (width / 2)
    const dy = (y - height / 2) / (height / 2)
    const r2 = dx * dx + dy * dy
    x += dx * barrel * r2 * width * 0.12
    y += dy * barrel * r2 * height * 0.12
    // 系统性应变偏差：横向轻微压缩/拉伸
    x += (nx - 0.5) * bias * width * 0.06
    return { x, y }
  }

  ctx.strokeStyle = '#1f2937'
  ctx.lineWidth = 1.6
  // 网格线
  for (let c = 0; c <= cols; c++) {
    const nx = c / cols
    ctx.beginPath()
    for (let r = 0; r <= rows; r++) {
      const p = project(nx, r / rows)
      if (r === 0) ctx.moveTo(p.x, p.y)
      else ctx.lineTo(p.x, p.y)
    }
    ctx.stroke()
  }
  for (let r = 0; r <= rows; r++) {
    const ny = r / rows
    ctx.beginPath()
    for (let c = 0; c <= cols; c++) {
      const p = project(c / cols, ny)
      if (c === 0) ctx.moveTo(p.x, p.y)
      else ctx.lineTo(p.x, p.y)
    }
    ctx.stroke()
  }
  // 真值交点
  for (let r = 0; r <= rows; r++) {
    for (let c = 0; c <= cols; c++) {
      truth.push(project(c / cols, r / rows))
    }
  }

  // 高斯噪声
  const img = ctx.getImageData(0, 0, width, height)
  for (let i = 0; i < img.data.length; i += 4) {
    const gauss = (rng() + rng() + rng() - 1.5) * noise
    img.data[i] = clamp255(img.data[i] + gauss)
    img.data[i + 1] = clamp255(img.data[i + 1] + gauss)
    img.data[i + 2] = clamp255(img.data[i + 2] + gauss)
  }
  ctx.putImageData(img, 0, 0)

  // 轻微模糊模拟失焦
  if (blur > 0) {
    const copy = document.createElement('canvas')
    copy.width = width
    copy.height = height
    copy.getContext('2d')?.drawImage(canvas, 0, 0)
    ctx.filter = `blur(${blur}px)`
    ctx.drawImage(copy, 0, 0)
    ctx.filter = 'none'
  }

  // 暗角
  const vignette = ctx.createRadialGradient(
    width / 2,
    height / 2,
    Math.min(width, height) * 0.35,
    width / 2,
    height / 2,
    Math.max(width, height) * 0.7,
  )
  vignette.addColorStop(0, 'rgba(0,0,0,0)')
  vignette.addColorStop(1, 'rgba(30,25,15,0.22)')
  ctx.fillStyle = vignette
  ctx.fillRect(0, 0, width, height)

  return { canvas, truth, cols, rows }
}

function clamp255(v: number) {
  return Math.max(0, Math.min(255, Math.round(v)))
}
