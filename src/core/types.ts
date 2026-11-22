// 领域核心类型定义，全系统单位：长度 mm，角度 deg，温度 ℃，时间 s

export type CrossSectionType = 'circle' | 'ellipse' | 'rounded-rect'

// 母线控制点：高度 z 与该处的特征半径 r（圆为半径，椭圆/方瓶为半宽）
export interface ProfilePoint {
  z: number
  r: number
}

export interface CircleSection {
  type: 'circle'
}

export interface EllipseSection {
  type: 'ellipse'
  // 半深 / 半宽 的比值（纵深方向相对径向特征尺寸）
  depthRatio: number
}

export interface RoundedRectSection {
  type: 'rounded-rect'
  // 半深 / 半宽
  depthRatio: number
  // 圆角半径相对半宽的比例 0.05~0.5
  cornerRatio: number
}

export type CrossSection = CircleSection | EllipseSection | RoundedRectSection

export interface BottleProfile {
  id: string
  name: string
  // 瓶身总高
  height: number
  // 母线点，z 升序，z=0 为瓶底
  points: ProfilePoint[]
  section: CrossSection
  // 标签覆盖高度区间
  labelZMin: number
  labelZMax: number
  updatedAt: number
}

// 膜材收缩曲线控制点：温度 -> 自由热收缩率（分数，0.45 = 45%）
export interface ShrinkCurvePoint {
  temp: number
  shrink: number
}

export type FilmMaterialType = 'PETG' | 'PVC' | 'OPS'

export interface FilmBatch {
  id: string
  material: FilmMaterialType
  name: string
  thicknessUm: number
  // TD 横向（环向）收缩曲线
  tdCurve: ShrinkCurvePoint[]
  // MD 纵向收缩曲线
  mdCurve: ShrinkCurvePoint[]
  // 该批次实测极限收缩率（用于超限标红）
  tdLimit: number
  updatedAt: number
}

// 收缩炉温区
export interface FurnaceZone {
  id: string
  name: string
  kind: 'steam' | 'hot-air'
  temp: number
  dwell: number
}

export interface FurnaceProfile {
  id: string
  name: string
  zones: FurnaceZone[]
  updatedAt: number
}

// 稿件刚性区（logo/文字），平面稿归一化坐标 0~1
export interface RigidRegion {
  id: string
  name: string
  x: number
  y: number
  w: number
  h: number
}

// 条码/二维码区域
export interface CodeRegion {
  id: string
  name: string
  kind: 'barcode' | 'qrcode'
  x: number
  y: number
  w: number
  h: number
}

export interface Artwork {
  id: string
  name: string
  widthMm: number
  heightMm: number
  // 原始位图 dataURL（PNG），SVG 栅格化后同样存这里
  imageDataUrl: string
  whiteUnderprint: boolean
  // 透明窗区域（归一化）
  clearWindows: RigidRegion[]
  rigidRegions: RigidRegion[]
  codeRegions: CodeRegion[]
  // 搭接区宽度 mm（出图用）
  overlapMm: number
  updatedAt: number
}

// 逐高度几何分析行
export interface HeightAnalysisRow {
  z: number
  perimeter: number
  radius: number
  // 相对最大周长（套筒初始周长）所需环向收缩率
  requiredShrink: number
  overLimit: boolean
}

export interface BottleGeometry {
  profile: BottleProfile
  // 等间距高度采样
  zs: number[]
  // 每个高度的截面多边形（世界坐标 x,y），弧长均匀采样
  sections: { x: number; y: number }[][]
  perimeters: number[]
  analysis: HeightAnalysisRow[]
  maxPerimeter: number
}
