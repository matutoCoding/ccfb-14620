<script setup lang="ts">
import { computed } from 'vue'

interface Point {
  x: number
  y: number
}

const props = withDefaults(
  defineProps<{
    points: Point[]
    width?: number
    height?: number
    color?: string
    fill?: boolean
    yMax?: number
    xLabel?: string
    yLabel?: string
    secondPoints?: Point[]
    secondColor?: string
  }>(),
  {
    width: 360,
    height: 220,
    color: 'var(--c-primary)',
    fill: false,
    secondColor: 'var(--c-warn)',
  },
)

const pad = { l: 44, r: 16, t: 16, b: 32 }

const xs = computed(() => props.points.map((p) => p.x))
const ys = computed(() => {
  const all = props.points.map((p) => p.y)
  if (props.secondPoints) all.push(...props.secondPoints.map((p) => p.y))
  return all
})
const xMin = computed(() => Math.min(...xs.value))
const xMax = computed(() => Math.max(...xs.value))
const yMax = computed(() => props.yMax ?? Math.max(...ys.value) * 1.12)

function sx(x: number) {
  return pad.l + ((x - xMin.value) / Math.max(xMax.value - xMin.value, 1e-6)) * (props.width - pad.l - pad.r)
}
function sy(y: number) {
  return props.height - pad.b - (y / yMax.value) * (props.height - pad.t - pad.b)
}

const path = computed(() => props.points.map((p, i) => `${i === 0 ? 'M' : 'L'}${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`).join(' '))
const areaPath = computed(() => {
  if (!props.points.length) return ''
  const base = props.height - pad.b
  return `${path.value} L${sx(props.points.at(-1)!.x).toFixed(1)},${base} L${sx(props.points[0].x).toFixed(1)},${base} Z`
})
const secondPath = computed(() =>
  props.secondPoints
    ? props.secondPoints.map((p, i) => `${i === 0 ? 'M' : 'L'}${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`).join(' ')
    : '',
)
const ticks = computed(() => [0, 0.25, 0.5, 0.75, 1].map((t) => ({ t, y: sy(yMax.value * t), v: yMax.value * t })))
</script>

<template>
  <svg :width="width" :height="height" class="block">
    <g v-for="tick in ticks" :key="tick.t">
      <line :x1="pad.l" :x2="width - pad.r" :y1="tick.y" :y2="tick.y" stroke="var(--c-100)" stroke-width="1" />
      <text :x="pad.l - 6" :y="tick.y + 4" text-anchor="end" style="font-size: 12px; fill: var(--c-400)">
        {{ Math.round(tick.v * 100) }}%
      </text>
    </g>
    <path v-if="fill" :d="areaPath" :fill="color" opacity="0.1" />
    <path :d="path" fill="none" :stroke="color" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" />
    <path v-if="secondPoints" :d="secondPath" fill="none" :stroke="secondColor" stroke-width="2" stroke-dasharray="5 4" />
    <g v-for="(p, i) in points" :key="i">
      <circle :cx="sx(p.x)" :cy="sy(p.y)" r="3" :fill="color" />
      <text :x="sx(p.x)" :y="height - pad.b + 16" text-anchor="middle" style="font-size: 12px; fill: var(--c-400)">
        {{ p.x }}
      </text>
    </g>
    <text v-if="xLabel" :x="width / 2" :y="height - 4" text-anchor="middle" style="font-size: 12px; fill: var(--c-500)">{{ xLabel }}</text>
  </svg>
</template>
