<script setup lang="ts">
import { computed, ref } from 'vue'
import { store } from '@/state/store.ts'
import { buildBottleGeometry } from '@/core/geometry'
import { runShrinkSimulation } from '@/core/simulation'
import { generateGridPhoto, type SyntheticPhoto } from '@/core/synthetic_photo'
import { detectGridIntersections, verifyAgainstSimulation, type VerificationResult } from '@/core/verification'
import EmptyState from '@/components/EmptyState.vue'
import { iconCheck, iconGrid, iconChart } from '@/components/icons.ts'

const photo = ref<SyntheticPhoto | null>(null)
const detectCanvas = ref<HTMLCanvasElement | null>(null)
const result = ref<VerificationResult | null>(null)
const roundHistory = ref<{ round: number; mean: number; max: number }[]>([])
const strainBias = ref(0.06)
const noise = ref(18)
const perspective = ref(0.18)
const working = ref('')
// 实拍照片的网格规格（按试标印刷规格填写）
const gridCols = ref(16)
const gridRows = ref(12)

function synth() {
  photo.value = generateGridPhoto({
    cols: 16,
    rows: 12,
    strainBias: strainBias.value,
    noise: noise.value,
    perspective: perspective.value,
    seed: 42 + roundHistory.value.length,
  })
  result.value = null
  drawDetection(null)
}

// 导入现场试版实拍照片：按文件名或默认 16×12 网格解析
function importPhoto(evt: Event) {
  const input = evt.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  const url = URL.createObjectURL(file)
  const img = new Image()
  img.onload = () => {
    const canvas = document.createElement('canvas')
    const maxW = 1280
    const scale = Math.min(1, maxW / img.naturalWidth)
    canvas.width = Math.round(img.naturalWidth * scale)
    canvas.height = Math.round(img.naturalHeight * scale)
    canvas.getContext('2d')?.drawImage(img, 0, 0, canvas.width, canvas.height)
    photo.value = {
      canvas,
      truth: [],
      cols: gridCols.value,
      rows: gridRows.value,
    }
    result.value = null
    drawDetection(null)
    URL.revokeObjectURL(url)
  }
  img.src = url
  input.value = ''
}

function drawDetection(detected: { x: number; y: number }[] | null) {
  const c = detectCanvas.value
  if (!c || !photo.value) return
  const ctx = c.getContext('2d')
  if (!ctx) return
  c.width = photo.value.canvas.width
  c.height = photo.value.canvas.height
  ctx.drawImage(photo.value.canvas, 0, 0)
  if (detected) {
    ctx.fillStyle = '#dc2626'
    for (const p of detected) {
      ctx.beginPath()
      ctx.arc(p.x, p.y, 4, 0, Math.PI * 2)
      ctx.fill()
    }
  }
}

async function runVerify() {
  if (!store.bottle || !store.film || !store.furnace) {
    working.value = '请先选好瓶型、膜材与炉程'
    return
  }
  if (!photo.value) synth()
  working.value = '检测网格交点…'
  await new Promise((r) => setTimeout(r, 30))
  const detected = detectGridIntersections(photo.value!.canvas, photo.value!.cols, photo.value!.rows)
  drawDetection(detected)

  const geo = buildBottleGeometry(store.bottle)
  const film = store.correctedTdCurve ? { ...store.film, tdCurve: store.correctedTdCurve } : store.film
  const sim = runShrinkSimulation(geo, film, store.furnace, { nU: 128, nV: 80 })
  const photoWidthMm = geo.maxPerimeter
  const vr = verifyAgainstSimulation(
    sim,
    detected,
    photo.value!.cols,
    photo.value!.rows,
    photoWidthMm,
    photo.value!.canvas.width,
  )
  result.value = vr
  roundHistory.value.push({
    round: roundHistory.value.length + 1,
    mean: vr.meanDeviationMm,
    max: vr.maxDeviationMm,
  })
  working.value = `匹配 ${vr.matched} 个交点，平均偏差 ${vr.meanDeviationMm.toFixed(2)}mm`
}

function applyCorrection() {
  if (!result.value || !store.film) return
  store.correctedTdCurve = result.value.correctedTdCurve
  store.correctionRound += 1
  store.verification = result.value
  working.value = `已应用第 ${store.correctionRound} 轮膜材曲线修正，下一版预变形自动生效`
}

const heatColor = (v: number, max: number) => {
  const t = max > 0 ? Math.min(1, v / max) : 0
  // 浅青 -> 橙 -> 红
  const r = Math.round(236 + (220 - 236) * t)
  const g = Math.round(254 - 170 * t)
  const b = Math.round(255 - 220 * t)
  return `rgb(${r},${g},${b})`
}
const heatMax = computed(() => Math.max(...(result.value?.heatBands.map((b) => b.meanDeviation) ?? [1]), 0.01))
const improvedHalf = computed(() => {
  if (roundHistory.value.length < 2) return false
  const first = roundHistory.value[0].mean
  const latest = roundHistory.value.at(-1)!.mean
  return latest <= first * 0.5
})
</script>

<template>
  <div class="flex flex-col gap-6">
    <div class="card p-5">
      <h2 class="text-base mb-2">试版网格试标照片</h2>
      <div class="sub mb-4">内置合成器生成带透视、桶形畸变、噪声与失焦的实拍效果；现场使用时可直接导入试版照片</div>
      <div class="flex flex-wrap items-end gap-4 mb-4">
        <label class="param">应变偏差注入
          <input type="range" min="-0.15" max="0.15" step="0.01" v-model.number="strainBias" />
          <span class="val">{{ (strainBias * 100).toFixed(0) }}%</span>
        </label>
        <label class="param">噪声
          <input type="range" min="0" max="40" v-model.number="noise" />
          <span class="val">{{ noise }}</span>
        </label>
        <label class="param">透视强度
          <input type="range" min="0" max="0.35" step="0.01" v-model.number="perspective" />
          <span class="val">{{ perspective.toFixed(2) }}</span>
        </label>
        <label class="param">实拍网格列
          <input type="number" min="4" max="40" v-model.number="gridCols" />
        </label>
        <label class="param">实拍网格行
          <input type="number" min="4" max="40" v-model.number="gridRows" />
        </label>
        <button class="btn" @click="synth"><span v-html="iconGrid(16)"></span>合成试标照片</button>
        <label class="btn cursor-pointer">导入实拍照片
          <input type="file" accept="image/png,image/jpeg" class="hidden" @change="importPhoto" />
        </label>
        <button class="btn btn-primary" :disabled="!store.bottle" @click="runVerify">
          <span v-html="iconCheck(16)"></span>识别网格并核对仿真
        </button>
        <button class="btn" :disabled="!result" @click="applyCorrection">反修膜材曲线并用于下一版</button>
      </div>

      <div v-if="!photo" class="max-w-lg">
        <EmptyState :icon="iconCheck" title="还没有试标照片" subtitle="点击「合成试标照片」生成一组带噪声和透视的网格照片" />
      </div>
      <div v-else class="grid gap-5" style="grid-template-columns: 1fr 1fr">
        <div>
          <h3 class="text-sm font-semibold mb-2">
            试标照片
            <span v-if="photo.truth.length" class="tag ml-2">含真值交点 {{ photo.truth.length }} 个</span>
            <span v-else class="tag tag-warn ml-2">实拍照片，无真值，以仿真网格为基准</span>
          </h3>
          <div class="img-box"><img :src="photo.canvas.toDataURL()" /></div>
        </div>
        <div>
          <h3 class="text-sm font-semibold mb-2">检测交点叠加</h3>
          <div class="img-box"><canvas ref="detectCanvas"></canvas></div>
        </div>
      </div>
    </div>

    <div v-if="result" class="card p-5">
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-base flex items-center gap-2"><span v-html="iconChart(18)"></span>分区偏差热力图</h2>
        <div class="flex gap-3">
          <span class="tag">匹配交点 {{ result.matched }}</span>
          <span class="tag" :class="result.meanDeviationMm < 0.5 ? 'tag-ok' : 'tag-warn'">
            平均偏差 {{ result.meanDeviationMm.toFixed(3) }} mm
          </span>
          <span class="tag tag-danger">最大 {{ result.maxDeviationMm.toFixed(3) }} mm</span>
        </div>
      </div>
      <div class="heatmap">
        <div v-for="(b, i) in result.heatBands" :key="i" class="heat-col" :style="{ background: heatColor(b.meanDeviation, heatMax) }">
          <div class="heat-z">z={{ b.z.toFixed(0) }}</div>
          <div class="heat-v">{{ b.meanDeviation.toFixed(2) }}</div>
          <div class="heat-d">{{ (b.strainDelta * 100).toFixed(1) }}%</div>
        </div>
      </div>
      <div class="heat-legend">
        <span>偏差低</span>
        <div class="legend-bar"></div>
        <span>偏差高</span>
        <span class="ml-6 sub">柱底三行：高度 mm / 平均偏差 mm / 横向应变偏差</span>
      </div>

      <h3 class="text-sm font-semibold mt-6 mb-2">修正迭代记录（验收：两轮后平均偏差减半）</h3>
      <div class="table-wrap">
        <table class="data">
          <thead><tr><th>轮次</th><th>平均偏差 mm</th><th>最大偏差 mm</th><th>相对首轮</th><th>结论</th></tr></thead>
          <tbody>
            <tr v-for="h in roundHistory" :key="h.round">
              <td>第 {{ h.round }} 轮</td>
              <td>{{ h.mean.toFixed(3) }}</td>
              <td>{{ h.max.toFixed(3) }}</td>
              <td>{{ ((h.mean / roundHistory[0].mean) * 100).toFixed(0) }}%</td>
              <td>
                <span v-if="h.round === 1" class="tag">基线</span>
                <span v-else-if="h.mean <= roundHistory[0].mean * 0.5" class="tag tag-ok">已减半达标</span>
                <span v-else class="tag tag-warn">继续迭代</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-if="improvedHalf" class="alert-ok mt-4">
        第 {{ roundHistory.length }} 轮平均偏差已降至首轮的 50% 以下，满足两轮迭代减半的验收要求
      </div>
    </div>
    <div v-if="working" class="status-line">{{ working }}</div>
  </div>
</template>

<style scoped>
.sub { font-size: var(--fs-xs); color: var(--c-400); }
.hidden { display: none; }
.param { display: flex; flex-direction: column; gap: 4px; font-size: var(--fs-xs); color: var(--c-500); }
.param input { width: 150px; }
.val { font-weight: 600; color: var(--c-700); }
.img-box { border: 1px solid var(--c-100); border-radius: var(--radius); background: var(--c-25); padding: var(--sp-3); display: flex; justify-content: center; }
.img-box img, .img-box canvas { max-width: 100%; max-height: 340px; }
.heatmap { display: grid; grid-template-columns: repeat(10, 1fr); gap: var(--sp-2); }
.heat-col { border-radius: var(--radius-sm); padding: var(--sp-3) var(--sp-2); text-align: center; min-height: 110px; display: flex; flex-direction: column; justify-content: flex-end; border: 1px solid var(--c-100); }
.heat-z { font-size: 12px; color: var(--c-600); font-weight: 600; }
.heat-v { font-size: var(--fs-sm); font-weight: 600; color: var(--c-800); }
.heat-d { font-size: 12px; color: var(--c-500); }
.heat-legend { display: flex; align-items: center; gap: var(--sp-2); margin-top: var(--sp-3); font-size: var(--fs-xs); color: var(--c-500); }
.legend-bar { width: 160px; height: 10px; border-radius: var(--radius-sm); background: linear-gradient(90deg, #ecfeff, #fbbf24, #dc2626); }
.ml-6 { margin-left: var(--sp-6); }
.mt-4 { margin-top: var(--sp-4); }
.mt-6 { margin-top: var(--sp-6); }
.alert-ok { padding: var(--sp-3) var(--sp-4); background: var(--c-ok-soft); border-radius: var(--radius); color: var(--c-ok); font-weight: 500; }
.status-line { font-size: var(--fs-xs); color: var(--c-primary-strong); }
</style>
