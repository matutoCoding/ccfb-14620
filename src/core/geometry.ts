import type {
  BottleGeometry,
  BottleProfile,
  CrossSection,
  HeightAnalysisRow,
  ProfilePoint,
} from './types.ts'

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t

// 单调曲线查表插值，xs 必须升序；超出范围按端点钳制
export function interp1(xs: number[], ys: number[], x: number): number {
  if (x <= xs[0]) return ys[0]
  const last = xs.length - 1
  if (x >= xs[last]) return ys[last]
  let lo = 0
  let hi = last
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (xs[mid] <= x) lo = mid
    else hi = mid
  }
  const t = (x - xs[lo]) / (xs[hi] - xs[lo])
  return lerp(ys[lo], ys[hi], t)
}

// 母线线性插值：给定 z 返回特征半径 r
export function radiusAt(points: ProfilePoint[], z: number): number {
  if (z <= points[0].z) return points[0].r
  const last = points.length - 1
  if (z >= points[last].z) return points[last].r
  for (let i = 0; i < last; i++) {
    const a = points[i]
    const b = points[i + 1]
    if (z >= a.z && z <= b.z) {
      return lerp(a.r, b.r, (z - a.z) / (b.z - a.z))
    }
  }
  return points[last].r
}

// 截面多边形：参数 u∈[0,1) 沿周向走一圈，返回世界坐标 x,y
// 圆与椭圆按角度参数化；圆角矩形按「直线段+圆弧」构造
function sectionPoint(section: CrossSection, r: number, u: number): { x: number; y: number } {
  const theta = u * Math.PI * 2
  if (section.type === 'circle') {
    return { x: r * Math.cos(theta), y: r * Math.sin(theta) }
  }
  if (section.type === 'ellipse') {
    const ry = r * section.depthRatio
    return { x: r * Math.cos(theta), y: ry * Math.sin(theta) }
  }
  // 圆角矩形：半宽 r，半深 r*depthRatio，圆角半径 cr
  const hw = r
  const hh = r * section.depthRatio
  const cr = Math.min(r * section.cornerRatio, hw * 0.95, hh * 0.95)
  const sx = hw - cr
  const sy = hh - cr
  // 四段直线 + 四段圆弧，每段按弧长占比分配参数区间
  const straightH = 2 * sx
  const straightV = 2 * sy
  const arc = (Math.PI / 2) * cr
  const total = 2 * straightH + 2 * straightV + 4 * arc
  let p = u * total
  const take = (len: number) => {
    const t = Math.min(p / len, 1)
    p -= len
    return t
  }
  // 顶边：左 -> 右
  if (p < straightH) {
    const t = take(straightH)
    return { x: -sx + t * 2 * sx, y: -hh }
  }
  p -= straightH
  // 右上圆角
  if (p < arc) {
    const t = take(arc)
    const a = -Math.PI / 2 + t * Math.PI / 2
    return { x: sx + cr * Math.cos(a), y: -sy + cr * Math.sin(a) }
  }
  p -= arc
  // 右边
  if (p < straightV) {
    const t = take(straightV)
    return { x: hw, y: -sy + t * 2 * sy }
  }
  p -= straightV
  // 右下圆角
  if (p < arc) {
    const t = take(arc)
    const a = t * Math.PI / 2
    return { x: sx + cr * Math.cos(a), y: sy + cr * Math.sin(a) }
  }
  p -= arc
  // 底边
  if (p < straightH) {
    const t = take(straightH)
    return { x: sx - t * 2 * sx, y: hh }
  }
  p -= straightH
  // 左下圆角
  if (p < arc) {
    const t = take(arc)
    const a = Math.PI / 2 + t * Math.PI / 2
    return { x: -sx + cr * Math.cos(a), y: sy + cr * Math.sin(a) }
  }
  p -= arc
  // 左边
  if (p < straightV) {
    const t = take(straightV)
    return { x: -hw, y: sy - t * 2 * sy }
  }
  p -= straightV
  // 左上圆角
  const t = Math.min(p / arc, 1)
  const a = Math.PI + t * Math.PI / 2
  return { x: -sx + cr * Math.cos(a), y: -sy + cr * Math.sin(a) }
}

export function polygonPerimeter(poly: { x: number; y: number }[]): number {
  let sum = 0
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]
    const b = poly[(i + 1) % poly.length]
    sum += Math.hypot(b.x - a.x, b.y - a.y)
  }
  return sum
}

// 按弧长均匀重采样截面，保证不同高度的第 k 个点材料方向对齐
function resampleArcLength(poly: { x: number; y: number }[], n: number) {
  const total = polygonPerimeter(poly)
  const cum: number[] = [0]
  for (let i = 1; i < poly.length; i++) {
    cum.push(cum[i - 1] + Math.hypot(poly[i].x - poly[i - 1].x, poly[i].y - poly[i - 1].y))
  }
  const out: { x: number; y: number }[] = []
  let seg = 0
  for (let k = 0; k < n; k++) {
    const target = (k / n) * total
    while (seg < poly.length - 2 && cum[seg + 1] < target) seg++
    const a = poly[seg]
    const b = poly[seg + 1]
    const span = cum[seg + 1] - cum[seg]
    const t = span > 1e-9 ? (target - cum[seg]) / span : 0
    out.push({ x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) })
  }
  return out
}

export const SECTION_SAMPLES = 160

export function buildBottleGeometry(
  profile: BottleProfile,
  zSteps = 96,
  sectionN = SECTION_SAMPLES,
  roughSamples = sectionN * 2,
): BottleGeometry {
  const zs: number[] = []
  const sections: { x: number; y: number }[][] = []
  const perimeters: number[] = []
  for (let i = 0; i <= zSteps; i++) {
    const z = (profile.height * i) / zSteps
    const r = radiusAt(profile.points, z)
    const rough: { x: number; y: number }[] = []
    for (let k = 0; k < roughSamples; k++) {
      rough.push(sectionPoint(profile.section, r, k / roughSamples))
    }
    const poly = resampleArcLength(rough, sectionN)
    zs.push(z)
    sections.push(poly)
    perimeters.push(polygonPerimeter(poly))
  }
  const maxPerimeter = Math.max(...perimeters)
  const analysis: HeightAnalysisRow[] = zs.map((z, i) => {
    const requiredShrink = 1 - perimeters[i] / maxPerimeter
    return {
      z,
      perimeter: perimeters[i],
      radius: radiusAt(profile.points, z),
      requiredShrink,
      // 极限值由调用方结合膜材批次注入，几何阶段不臆造默认值
      overLimit: false,
    }
  })
  return { profile, zs, sections, perimeters, analysis, maxPerimeter }
}

// 结合膜材 TD 极限，标注超限区段
export function markOverLimit(geo: BottleGeometry, tdLimit: number): HeightAnalysisRow[] {
  return geo.analysis.map((row) => ({
    ...row,
    overLimit: row.requiredShrink > tdLimit,
  }))
}
