import type { FurnaceProfile } from './types.ts'

const now = () => Date.now()

// 典型两段式蒸汽收缩炉 + 末段热风定型
export function makeSampleFurnaces(): FurnaceProfile[] {
  return [
    {
      id: 'furnace-standard',
      name: '标准蒸汽双段炉',
      updatedAt: now(),
      zones: [
        { id: 'z1', name: '预热蒸汽段', kind: 'steam', temp: 78, dwell: 2.5 },
        { id: 'z2', name: '主收缩蒸汽段', kind: 'steam', temp: 92, dwell: 3.5 },
        { id: 'z3', name: '热风定型段', kind: 'hot-air', temp: 88, dwell: 2 },
      ],
    },
    {
      id: 'furnace-gentle',
      name: '低温缓收炉（香水瓶用）',
      updatedAt: now(),
      zones: [
        { id: 'z1', name: '预热蒸汽段', kind: 'steam', temp: 72, dwell: 3 },
        { id: 'z2', name: '主收缩蒸汽段', kind: 'steam', temp: 84, dwell: 4.5 },
        { id: 'z3', name: '热风定型段', kind: 'hot-air', temp: 80, dwell: 2.5 },
      ],
    },
  ]
}
