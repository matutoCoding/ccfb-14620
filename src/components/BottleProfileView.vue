<script setup lang="ts">
import { computed } from 'vue'
import type { BottleGeometry } from '@/core/types'

const props = defineProps<{
  geo: BottleGeometry
  tdLimit: number | null
}>()

const w = 300
const h = 380
const pad = 24

const maxR = computed(() => Math.max(...geo2r(props.geo)))
const scale = computed(() => (w / 2 - pad) / Math.max(maxR.value, 1))

function geo2r(geo: BottleGeometry) {
  return geo.analysis.map((a) => a.radius)
}

function x(r: number) {
  return w / 2 + r * scale.value
}
function y(z: number) {
  return h - pad - (z / geo.value.profile.height) * (h - 2 * pad)
}

const geo = computed(() => props.geo)

const rightPath = computed(() =>
  geo.value.analysis.map((a, i) => `${i === 0 ? 'M' : 'L'}${x(a.radius).toFixed(1)},${y(a.z).toFixed(1)}`).join(' '),
)
const leftPath = computed(() =>
  geo.value.analysis.map((a, i) => `${i === 0 ? 'M' : 'L'}${x(-a.radius).toFixed(1)},${y(a.z).toFixed(1)}`).join(' '),
)
const fillPath = computed(() => {
  const rows = geo.value.analysis
  const right = rows.map((a) => `L${x(a.radius).toFixed(1)},${y(a.z).toFixed(1)}`).join(' ')
  const left = [...rows].reverse().map((a) => `L${x(-a.radius).toFixed(1)},${y(a.z).toFixed(1)}`).join(' ')
  return `M${x(rows[0].radius)},${y(rows[0].z)} ${right} ${left} Z`
})

// 超限区段标红
const redBands = computed(() => {
  if (props.tdLimit === null) return []
  return geo.value.analysis.filter((a) => a.requiredShrink > props.tdLimit)
})

const labelTop = computed(() => y(geo.value.profile.labelZMax))
const labelBottom = computed(() => y(geo.value.profile.labelZMin))
</script>

<template>
  <svg :width="w" :height="h" class="bottle-svg">
    <defs>
      <linearGradient id="bottleFill" x1="0" x2="1">
        <stop offset="0" stop-color="#e2e8f0" />
        <stop offset="0.5" stop-color="#f8fafc" />
        <stop offset="1" stop-color="#cbd5e1" />
      </linearGradient>
    </defs>
    <!-- 标签覆盖区 -->
    <rect :x="pad" :y="labelTop" :width="w - 2 * pad" :height="labelBottom - labelTop"
      fill="var(--c-primary-soft)" opacity="0.7" />
    <!-- 瓶身填充 -->
    <path :d="fillPath" fill="url(#bottleFill)" opacity="0.55" />
    <path :d="rightPath" fill="none" stroke="var(--c-700)" stroke-width="1.8" />
    <path :d="leftPath" fill="none" stroke="var(--c-700)" stroke-width="1.8" />
    <!-- 超限红标 -->
    <g v-for="(a, i) in redBands" :key="i">
      <line :x1="x(a.radius)" :x2="x(-a.radius)" :y1="y(a.z)" :y2="y(a.z)"
        stroke="var(--c-danger)" stroke-width="2.5" opacity="0.7" />
    </g>
    <!-- 标签边界 -->
    <line :x1="pad" :x2="w - pad" :y1="labelTop" :y2="labelTop" stroke="var(--c-primary)" stroke-dasharray="5 4" />
    <line :x1="pad" :x2="w - pad" :y1="labelBottom" :y2="labelBottom" stroke="var(--c-primary)" stroke-dasharray="5 4" />
    <text :x="w / 2" :y="h - 6" text-anchor="middle" style="font-size: 12px; fill: var(--c-400)">
      高 {{ geo.profile.height }}mm · 最大周长 {{ geo.maxPerimeter.toFixed(1) }}mm
    </text>
  </svg>
</template>

<style scoped>
.bottle-svg {
  background: var(--c-25);
  border: 1px solid var(--c-100);
  border-radius: var(--radius);
}
</style>
