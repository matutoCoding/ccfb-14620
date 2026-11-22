import type { Artwork, BottleProfile, FilmBatch, FurnaceProfile } from './types.ts'
import type { ShrinkSimulation } from './simulation.ts'

// 触发浏览器下载
export function downloadCanvas(canvas: HTMLCanvasElement, filename: string): void {
  canvas.toBlob((blob) => {
    if (!blob) return
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }, 'image/png')
}

// 在预变形稿上补搭接区与胶水线，导出制版 PNG
export function composePlate(
  warped: HTMLCanvasElement,
  artwork: Artwork,
  dpi = 300,
): HTMLCanvasElement {
  const pxPerMm = dpi / 25.4
  const overlapPx = Math.round(artwork.overlapMm * pxPerMm)
  const out = document.createElement('canvas')
  out.width = warped.width + overlapPx
  out.height = warped.height
  const ctx = out.getContext('2d')
  if (!ctx) throw new Error('画布不可用')
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, out.width, out.height)
  ctx.drawImage(warped, 0, 0)

  // 搭接区：复制原稿右缘一条做覆盖层
  ctx.globalAlpha = 0.55
  ctx.drawImage(
    warped,
    warped.width - Math.min(overlapPx, warped.width),
    0,
    Math.min(overlapPx, warped.width),
    warped.height,
    warped.width,
    0,
    overlapPx,
    warped.height,
  )
  ctx.globalAlpha = 1

  // 胶水线：红色虚线 + 标注
  ctx.strokeStyle = '#dc2626'
  ctx.lineWidth = 2
  ctx.setLineDash([10, 6])
  const glueX = warped.width + overlapPx * 0.35
  ctx.beginPath()
  ctx.moveTo(glueX, 12)
  ctx.lineTo(glueX, out.height - 12)
  ctx.stroke()
  ctx.setLineDash([])
  ctx.fillStyle = '#dc2626'
  ctx.font = '600 18px sans-serif'
  ctx.save()
  ctx.translate(glueX + 8, out.height / 2)
  ctx.rotate(-Math.PI / 2)
  ctx.fillText('胶水线', 0, 0)
  ctx.restore()

  // 裁切线标注
  ctx.strokeStyle = '#334155'
  ctx.lineWidth = 1
  ctx.setLineDash([4, 4])
  ctx.strokeRect(0.5, 0.5, warped.width - 1, warped.height - 1)
  ctx.setLineDash([])
  return out
}

export interface ProcessCardInput {
  bottle: BottleProfile
  film: FilmBatch
  furnace: FurnaceProfile
  sim: ShrinkSimulation
  artwork: Artwork
  correctionRound: number
}

// 工艺卡：可直接打印的独立 HTML 文档
export function buildProcessCardHtml(input: ProcessCardInput): string {
  const { bottle, film, furnace, sim, artwork, correctionRound } = input
  const zones = furnace.zones
    .map(
      (z) => `<tr><td>${z.name}</td><td>${z.kind === 'steam' ? '蒸汽' : '热风'}</td>
        <td>${z.temp}℃</td><td>${z.dwell}s</td></tr>`,
    )
    .join('')
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">
<title>套标工艺卡 - ${artwork.name}</title>
<style>
  body{font-family:'PingFang SC','Microsoft YaHei',sans-serif;padding:32px;color:#0f172a;}
  h1{font-size:22px;margin:0 0 6px;} .sub{color:#64748b;font-size:13px;margin-bottom:24px;}
  table{width:100%;border-collapse:collapse;margin:12px 0 24px;font-size:13px;}
  th,td{border:1px solid #cbd5e1;padding:8px 10px;text-align:left;}
  th{background:#f1f5f9;} .grid2{display:grid;grid-template-columns:1fr 1fr;gap:16px;}
  .box{border:1px solid #e2e8f0;border-radius:8px;padding:16px;}
  .box h3{font-size:14px;margin:0 0 10px;color:#0e7490;}
  .kv{display:flex;justify-content:space-between;padding:4px 0;font-size:13px;}
</style></head><body>
<h1>热收缩套标工艺卡</h1>
<div class="sub">生成时间 ${new Date().toLocaleString('zh-CN')} ｜ 修正轮次 第 ${correctionRound} 轮</div>
<div class="grid2">
  <div class="box"><h3>瓶型</h3>
    <div class="kv"><span>名称</span><b>${bottle.name}</b></div>
    <div class="kv"><span>瓶高</span><b>${bottle.height} mm</b></div>
    <div class="kv"><span>截面</span><b>${sectionLabel(bottle)}</b></div>
    <div class="kv"><span>标签区</span><b>${bottle.labelZMin} ~ ${bottle.labelZMax} mm</b></div>
    <div class="kv"><span>最大周长</span><b>${sim.geo.maxPerimeter.toFixed(1)} mm</b></div>
  </div>
  <div class="box"><h3>膜材批次</h3>
    <div class="kv"><span>牌号</span><b>${film.material}</b></div>
    <div class="kv"><span>批次</span><b>${film.name}</b></div>
    <div class="kv"><span>厚度</span><b>${film.thicknessUm} μm</b></div>
    <div class="kv"><span>TD 极限收缩率</span><b>${(film.tdLimit * 100).toFixed(1)}%</b></div>
  </div>
</div>
<div class="box" style="margin-top:16px"><h3>收缩炉温区</h3>
<table><thead><tr><th>温区</th><th>类型</th><th>温度</th><th>通过时间</th></tr></thead>
<tbody>${zones}</tbody></table></div>
<div class="box" style="margin-top:16px"><h3>制版参数</h3>
  <div class="kv"><span>稿件</span><b>${artwork.name}</b></div>
  <div class="kv"><span>印版周长</span><b>${artwork.widthMm} mm</b></div>
  <div class="kv"><span>裁切高度</span><b>${artwork.heightMm} mm</b></div>
  <div class="kv"><span>搭接区</span><b>${artwork.overlapMm} mm</b></div>
  <div class="kv"><span>白墨打底</span><b>${artwork.whiteUnderprint ? '是' : '否'}</b></div>
  <div class="kv"><span>仿真钉扎率</span><b>${(sim.finalPinnedRatio * 100).toFixed(1)}%</b></div>
</div>
</body></html>`
}

function sectionLabel(b: BottleProfile): string {
  switch (b.section.type) {
    case 'circle':
      return '回转圆截面'
    case 'ellipse':
      return `椭圆截面 深宽比 ${b.section.depthRatio}`
    case 'rounded-rect':
      return `圆角矩形 圆角比 ${b.section.cornerRatio}`
  }
}

export function downloadHtmlDoc(html: string, filename: string): void {
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
