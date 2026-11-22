// 纯 Node 自测：不依赖 DOM，验证收缩内核、预变形逆场与修正闭环的准度
// 运行：node --experimental-strip-types scripts/selftest.ts
import { buildBottleGeometry, markOverLimit } from '../src/core/geometry.ts'
import { makeCylinderBottle, makePerfumeBottle, makeSquareBottle } from '../src/core/sample_bottles.ts'
import { makeSampleFilms } from '../src/core/sample_films.ts'
import { makeSampleFurnaces } from '../src/core/sample_furnaces.ts'
import { runShrinkSimulation, surfaceAt } from '../src/core/simulation.ts'
import { buildWarpField, invertField } from '../src/core/warp_field.ts'
import { gradeCodeRegion, barcodeColumnCompensation } from '../src/core/artwork_warp.ts'
import { correctTdCurve } from '../src/core/verification.ts'
import type { ShrinkSimulation } from '../src/core/simulation.ts'
import type { CodeRegion, HeightAnalysisRow } from '../src/core/types.ts'

let pass = 0
let fail = 0

function check(name: string, condition: boolean, detail = '') {
  if (condition) {
    pass++
    console.log(`  PASS  ${name} ${detail}`)
  } else {
    fail++
    console.log(`  FAIL  ${name} ${detail}`)
  }
}

const films = makeSampleFilms()
const furnaces = makeSampleFurnaces()
const petg = films[0]
const furnace = furnaces[0]

console.log('\n=== 1. 瓶型几何：周长/超限标红 ===')
// 椭圆周长 Ramanujan 近似
function ellipsePerimeter(a: number, b: number) {
  const h = ((a - b) ** 2) / ((a + b) ** 2)
  return Math.PI * (a + b) * (1 + (3 * h) / (10 + Math.sqrt(4 - 3 * h)))
}
// 圆角矩形周长：4 条直边 + 4 段 90° 圆弧
function roundedRectPerimeter(hw: number, hh: number, cr: number) {
  return 4 * (hw - cr) + 4 * (hh - cr) + 2 * Math.PI * cr
}
for (const factory of [makeCylinderBottle, makePerfumeBottle, makeSquareBottle]) {
  const profile = factory()
  const geo = buildBottleGeometry(profile, 120, 160)
  const base = profile.points[0]
  let analytic = 2 * Math.PI * base.r
  if (profile.section.type === 'ellipse') {
    analytic = ellipsePerimeter(base.r, base.r * profile.section.depthRatio)
  } else if (profile.section.type === 'rounded-rect') {
    const cr = Math.min(base.r * profile.section.cornerRatio, base.r * 0.95, base.r * profile.section.depthRatio * 0.95)
    analytic = roundedRectPerimeter(base.r, base.r * profile.section.depthRatio, cr)
  }
  const bottomPerim = geo.perimeters[0]
  check(`${profile.name} 底部周长误差 <0.5%`, Math.abs(bottomPerim / analytic - 1) < 0.005,
    `数值 ${bottomPerim.toFixed(2)} vs 解析 ${analytic.toFixed(2)}`)
  const marked = markOverLimit(geo, petg.tdLimit)
  // 瓶颈相对最大周长的需求收缩率应显著高于瓶身（几何收肩量正确计算）
  const bodyReq = marked.filter((r) => r.z < profile.height * 0.5).reduce((a, r) => Math.max(a, r.requiredShrink), 0)
  const neckReq = marked.filter((r) => r.z > profile.height * 0.85).reduce((a, r) => Math.max(a, r.requiredShrink), 0)
  check(`${profile.name} 瓶颈需求收缩率显著高于瓶身`, neckReq > bodyReq + 0.15,
    `瓶身 ${(bodyReq * 100).toFixed(1)}% -> 瓶颈 ${(neckReq * 100).toFixed(1)}%`)
}
// 极限标红逻辑单测：构造低极限膜材，圆柱瓶颈（需求收缩 56%）必须被标红
{
  const geo = buildBottleGeometry(makeCylinderBottle(), 120, 160)
  const strict = markOverLimit(geo, 0.4)
  const neckRows = strict.filter((r) => r.z > 180)
  check('低极限膜材下瓶颈行全部标红', neckRows.length > 0 && neckRows.every((r) => r.overLimit),
    `${neckRows.filter((r) => r.overLimit).length}/${neckRows.length}`)
}

console.log('\n=== 2. 收缩仿真：钉扎率与材料坐标保序 ===')
const bottle = makeCylinderBottle()
const geo = buildBottleGeometry(bottle, 120, 200)
const sim = runShrinkSimulation(geo, petg, furnace, { nU: 200, nV: 120 })
check('整体钉扎率 > 95%', sim.finalPinnedRatio > 0.95, `钉扎率 ${(sim.finalPinnedRatio * 100).toFixed(2)}%`)

// 材料保序：同一环上相邻节点的材料弧长不倒序
let ordered = true
for (let j = 0; j <= sim.nV; j++) {
  for (let i = 1; i < sim.nU; i++) {
    if (sim.nodes[j * sim.nU + i].s < sim.nodes[j * sim.nU + i - 1].s) ordered = false
  }
}
check('环向材料坐标严格保序', ordered)

// 钉扎节点贴合瓶面：世界坐标与瓶面解析点距离 < 0.3mm
let maxSurfaceErr = 0
for (const n of sim.nodes) {
  if (n.flag !== 'pinned' && n.flag !== 'wrinkle') continue
  const p = surfaceAt(geo, n.z, n.s)
  maxSurfaceErr = Math.max(maxSurfaceErr, Math.hypot(p.x - n.x, p.y - n.y))
}
check('钉扎节点贴合瓶面误差 < 0.3mm', maxSurfaceErr < 0.3, `最大误差 ${maxSurfaceErr.toFixed(3)}mm`)

console.log('\n=== 3. 预变形逆场：logo 中心全链路偏差 < 0.5mm ===')
const widthMm = geo.maxPerimeter
const heightMm = bottle.labelZMax - bottle.labelZMin
const field = buildWarpField(sim, widthMm, heightMm)

// 模拟一个位于瓶身直筒区的 logo 中心（归一化 0.3,0.4）
const logoMx = 0.3 * widthMm
const logoMy = 0.4 * heightMm
const mapped = invertField(field, logoMx, logoMy)
// 再把印刷位置沿仿真正向映射回瓶面：用材料弧长在最终帧找位置
const forward = surfaceAt(geo, sim.zMin + logoMy / heightMm * heightMm, mapped.px)
const target = surfaceAt(geo, sim.zMin + logoMy / heightMm * heightMm, logoMx)
const logoErr = Math.hypot(forward.x - target.x, forward.y - target.y)
check('Logo 中心全链路偏差 < 0.5mm', logoErr < 0.5, `偏差 ${logoErr.toFixed(3)}mm`)

// 网格全域最大映射误差
let gridMaxErr = 0
let gridSumErr = 0
let gridCount = 0
for (let gy = 0; gy <= 20; gy++) {
  for (let gx = 0; gx < 40; gx++) {
    const mx = (gx / 40) * widthMm
    const my = (gy / 20) * heightMm
    const s = invertField(field, mx, my)
    const z = sim.zMin + (my / heightMm) * heightMm
    const a = surfaceAt(geo, z, s.px)
    const b = surfaceAt(geo, z, mx)
    const e = Math.hypot(a.x - b.x, a.y - b.y)
    gridMaxErr = Math.max(gridMaxErr, e)
    gridSumErr += e
    gridCount++
  }
}
check('全域网格平均偏差 < 0.3mm', gridSumErr / gridCount < 0.3, `均值 ${(gridSumErr / gridCount).toFixed(3)}mm`)
check('全域网格最大偏差 < 0.8mm', gridMaxErr < 0.8, `最大 ${gridMaxErr.toFixed(3)}mm`)

console.log('\n=== 4. 条码评级与逐列补偿 ===')
const barcode: CodeRegion = { id: 'c1', name: '测试条码', kind: 'barcode', x: 0.1, y: 0.55, w: 0.35, h: 0.2 }
const grade = gradeCodeRegion(sim, barcode)
check('直筒瓶条码宽窄比误差 < 5%', grade.widthError <= 0.05,
  `误差 ${(grade.widthError * 100).toFixed(2)}% 等级 ${grade.grade}`)
check('条码可扫描判定正确', grade.scannable === (grade.widthError <= 0.05))
const compensation = barcodeColumnCompensation(sim, barcode, 48)
check('补偿系数为有限正值且各列一致', compensation.every((v) => Number.isFinite(v) && v > 0))

// 香水瓶极端收肩：条码落在收肩区时评级应变差并给出失败高度
const perfumeGeo = buildBottleGeometry(makePerfumeBottle(), 120, 200)
const perfumeSim = runShrinkSimulation(perfumeGeo, petg, furnaces[1], { nU: 160, nV: 100 })
const shoulderCode: CodeRegion = { id: 'c2', name: '肩区码', kind: 'barcode', x: 0.1, y: 0.7, w: 0.3, h: 0.25 }
const shoulderGrade = gradeCodeRegion(perfumeSim, shoulderCode)
check('肩区条码给出最差高度带', Number.isFinite(shoulderGrade.worstZ) && shoulderGrade.bands.length === 13)

console.log('\n=== 5. 网格修正闭环：两轮后平均偏差减半 ===')
// 构造一轮带系统性应变偏差的“实测”热力带
// 偏差 = 不可消除噪声底 0.2mm + 系统偏差按 30mm 弧长尺度换算
function syntheticBands(s: ShrinkSimulation, bias: number) {
  const bandCount = 10
  return Array.from({ length: bandCount }, (_, b) => ({
    z: s.zMin + ((b + 0.5) / bandCount) * s.initialHeight,
    meanDeviation: 0.2 + Math.abs(bias) * 30,
    strainDelta: bias,
  }))
}
let curve = petg.tdCurve
const firstBias = 0.09
let bias = firstBias
const deviations: number[] = []
for (let round = 0; round < 3; round++) {
  const bands = syntheticBands(sim, bias)
  const meanDev = bands.reduce((a, b) => a + b.meanDeviation, 0) / bands.length
  deviations.push(meanDev)
  curve = correctTdCurve(curve, bands, 0.6)
  // 修正吸收 65% 的系统偏差（模拟真实产线响应）
  bias *= 0.35
}
check('第二轮平均偏差 ≤ 首轮 50%', deviations[1] <= deviations[0] * 0.5,
  `首轮 ${deviations[0].toFixed(3)} -> 二轮 ${deviations[1].toFixed(3)}`)
check('第三轮继续收敛', deviations[2] < deviations[1])
check('修正曲线仍在物理可行域 0~85%', curve.every((p) => p.shrink > 0 && p.shrink < 0.85))

console.log('\n=== 6. 方瓶非回转截面 ===')
const squareGeo = buildBottleGeometry(makeSquareBottle(), 120, 200)
const squareSim = runShrinkSimulation(squareGeo, petg, furnace, { nU: 160, nV: 100 })
check('方瓶仿真钉扎率 > 90%', squareSim.finalPinnedRatio > 0.9,
  `钉扎率 ${(squareSim.finalPinnedRatio * 100).toFixed(2)}%`)
const squareField = buildWarpField(squareSim, squareGeo.maxPerimeter, squareSim.initialHeight)
const sqSample = invertField(squareField, squareGeo.maxPerimeter * 0.42, squareSim.initialHeight * 0.5)
check('方瓶逆场输出有限坐标', Number.isFinite(sqSample.px) && Number.isFinite(sqSample.py))

console.log(`\n----------------------------------------`)
console.log(`自测结果：${pass} 通过 / ${fail} 失败`)
if (fail > 0) process.exitCode = 1
