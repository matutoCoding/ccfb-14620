import type { BottleProfile } from './types.ts'

const now = () => Date.now()

// 圆柱饮料瓶：直筒身 + 收肩 + 细颈
export function makeCylinderBottle(): BottleProfile {
  return {
    id: 'bottle-cylinder',
    name: '圆柱饮料瓶 500ml',
    height: 220,
    labelZMin: 20,
    labelZMax: 170,
    section: { type: 'circle' },
    points: [
      { z: 0, r: 32 },
      { z: 150, r: 32 },
      { z: 160, r: 31 },
      { z: 185, r: 14 },
      { z: 200, r: 14 },
      { z: 210, r: 16 },
      { z: 220, r: 16 },
    ],
    updatedAt: now(),
  }
}

// 细颈香水瓶：椭圆截面，肩颈收得极狠
export function makePerfumeBottle(): BottleProfile {
  return {
    id: 'bottle-perfume',
    name: '细颈香水瓶 100ml',
    height: 150,
    labelZMin: 12,
    labelZMax: 118,
    section: { type: 'ellipse', depthRatio: 0.62 },
    points: [
      { z: 0, r: 26 },
      { z: 80, r: 26 },
      { z: 95, r: 24 },
      { z: 112, r: 9 },
      { z: 135, r: 8 },
      { z: 150, r: 9 },
    ],
    updatedAt: now(),
  }
}

// 洗发水方瓶：圆角矩形截面，带握把凹槽（母线中段内收）
export function makeSquareBottle(): BottleProfile {
  return {
    id: 'bottle-square',
    name: '握把凹槽洗发水方瓶 750ml',
    height: 240,
    labelZMin: 18,
    labelZMax: 200,
    section: { type: 'rounded-rect', depthRatio: 0.68, cornerRatio: 0.16 },
    points: [
      { z: 0, r: 38 },
      { z: 24, r: 38 },
      // 握把凹槽：半宽内收 6mm 再回升
      { z: 70, r: 38 },
      { z: 90, r: 32 },
      { z: 130, r: 32 },
      { z: 150, r: 38 },
      { z: 190, r: 38 },
      { z: 205, r: 33 },
      { z: 222, r: 15 },
      { z: 240, r: 15 },
    ],
    updatedAt: now(),
  }
}

export function makeSampleBottles(): BottleProfile[] {
  return [makeCylinderBottle(), makePerfumeBottle(), makeSquareBottle()]
}
