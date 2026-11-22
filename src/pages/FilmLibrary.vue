<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import type { FilmBatch, FilmMaterialType, ShrinkCurvePoint } from '@/core/types'
import { filmRepo } from '@/db/repos.ts'
import { remove, uid } from '@/db/indexeddb.ts'
import { store } from '@/state/store.ts'
import LineChart from '@/components/LineChart.vue'
import EmptyState from '@/components/EmptyState.vue'
import { iconFilm, iconPlus, iconTrash } from '@/components/icons.ts'

const films = ref<FilmBatch[]>([])
const selectedId = ref('')
const editing = ref(false)
const materials: FilmMaterialType[] = ['PETG', 'PVC', 'OPS']

const draft = reactive<FilmBatch>(blank())

function blank(): FilmBatch {
  return {
    id: uid('film'),
    material: 'PETG',
    name: '新膜材批次',
    thicknessUm: 40,
    tdLimit: 0.7,
    tdCurve: [
      { temp: 60, shrink: 0.02 },
      { temp: 80, shrink: 0.4 },
      { temp: 100, shrink: 0.7 },
    ],
    mdCurve: [
      { temp: 60, shrink: 0.01 },
      { temp: 80, shrink: 0.1 },
      { temp: 100, shrink: 0.18 },
    ],
    updatedAt: Date.now(),
  }
}

async function load() {
  films.value = await filmRepo.list()
  if (!selectedId.value && films.value.length) selectedId.value = films.value[0].id
}
onMounted(load)

const selected = computed(() => films.value.find((f) => f.id === selectedId.value) ?? null)
const tdPoints = computed(() => (selected.value ? selected.value.tdCurve.map((p) => ({ x: p.temp, y: p.shrink })) : []))
const mdPoints = computed(() => (selected.value ? selected.value.mdCurve.map((p) => ({ x: p.temp, y: p.shrink })) : []))
const correctedPoints = computed(() =>
  store.correctedTdCurve && selected.value?.id === store.film?.id
    ? store.correctedTdCurve.map((p) => ({ x: p.temp, y: p.shrink }))
    : [],
)

function openCreate() {
  Object.assign(draft, blank())
  editing.value = true
}
function openEdit(f: FilmBatch) {
  Object.assign(draft, structuredClone(f))
  editing.value = true
}
async function save() {
  draft.tdCurve.sort((a, b) => a.temp - b.temp)
  draft.mdCurve.sort((a, b) => a.temp - b.temp)
  await filmRepo.save(structuredClone(draft))
  editing.value = false
  await load()
}
async function del(f: FilmBatch) {
  await remove('films', f.id)
  if (selectedId.value === f.id) selectedId.value = ''
  await load()
}
function useFilm(f: FilmBatch) {
  store.film = f
}
function addCurvePoint(dir: 'tdCurve' | 'mdCurve') {
  const curve = draft[dir]
  curve.push({ temp: (curve.at(-1)?.temp ?? 80) + 10, shrink: 0.1 })
}
</script>

<template>
  <div v-if="!films.length" class="max-w-lg">
    <EmptyState :icon="iconFilm" title="还没有膜材批次" subtitle="录入 PETG / PVC / OPS 的 TD/MD 收缩曲线">
      <button class="btn btn-primary" @click="openCreate">新建批次</button>
    </EmptyState>
  </div>

  <div v-else class="grid gap-6" style="grid-template-columns: 360px 1fr">
    <div class="card p-4 h-fit">
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-base">膜材批次</h2>
        <button class="btn btn-primary" @click="openCreate"><span v-html="iconPlus(16)"></span>新建</button>
      </div>
      <div class="flex flex-col gap-2">
        <div v-for="f in films" :key="f.id" class="film-card" :class="{ active: f.id === selectedId }" @click="selectedId = f.id">
          <div class="flex-1">
            <div class="font-medium">{{ f.name }}</div>
            <div class="sub">{{ f.material }} · {{ f.thicknessUm }}μm · TD 极限 {{ (f.tdLimit * 100).toFixed(0) }}%</div>
          </div>
          <div class="flex gap-1" @click.stop>
            <button class="btn" @click="openEdit(f)">编辑</button>
            <button class="btn btn-danger" @click="del(f)"><span v-html="iconTrash(16)"></span></button>
          </div>
        </div>
      </div>
    </div>

    <div v-if="selected" class="card p-5">
      <div class="flex items-start justify-between mb-4">
        <div>
          <h2 class="text-base mb-1">{{ selected.name }}</h2>
          <div class="flex gap-2">
            <span class="tag">{{ selected.material }}</span>
            <span class="tag">{{ selected.thicknessUm }} μm</span>
            <span class="tag tag-warn">TD 极限 {{ (selected.tdLimit * 100).toFixed(1) }}%</span>
            <span v-if="store.film?.id === selected.id" class="tag tag-ok">当前膜材</span>
            <span v-if="store.correctedTdCurve && store.film?.id === selected.id" class="tag">已应用第 {{ store.correctionRound }} 轮修正</span>
          </div>
        </div>
        <button class="btn btn-primary" @click="useFilm(selected)">用于仿真</button>
      </div>
      <div class="flex gap-6">
        <div>
          <h3 class="text-sm font-semibold mb-2">TD 横向收缩曲线</h3>
          <LineChart :points="tdPoints" :second-points="correctedPoints" x-label="温度 ℃" y-label="收缩率" :height="240" />
          <div v-if="correctedPoints.length" class="chart-legend">
            <span class="dot solid"></span>原始曲线
            <span class="dot dash"></span>核对修正曲线
          </div>
        </div>
        <div>
          <h3 class="text-sm font-semibold mb-2">MD 纵向收缩曲线</h3>
          <LineChart :points="mdPoints" color="var(--c-warn)" x-label="温度 ℃" y-label="收缩率" :height="240" />
        </div>
      </div>
    </div>
  </div>

  <div v-if="editing" class="modal-mask" @click.self="editing = false">
    <div class="modal card">
      <div class="modal-head"><h2 class="text-base">膜材批次</h2></div>
      <div class="modal-body">
        <div class="grid grid-cols-4 gap-3 mb-4">
          <div>
            <label class="label">材料</label>
            <select v-model="draft.material" class="select">
              <option v-for="m in materials" :key="m" :value="m">{{ m }}</option>
            </select>
          </div>
          <div>
            <label class="label">批次名称</label>
            <input v-model="draft.name" class="input" />
          </div>
          <div>
            <label class="label">厚度 μm</label>
            <input v-model.number="draft.thicknessUm" type="number" class="input" />
          </div>
          <div>
            <label class="label">TD 极限收缩率</label>
            <input v-model.number="draft.tdLimit" type="number" step="0.01" min="0" max="0.9" class="input" />
          </div>
        </div>
        <div class="grid grid-cols-2 gap-6">
          <div v-for="dir in (['tdCurve','mdCurve'] as const)" :key="dir">
            <div class="flex items-center justify-between mb-2">
              <h3 class="text-sm font-semibold">{{ dir === 'tdCurve' ? 'TD 横向曲线' : 'MD 纵向曲线' }}</h3>
              <button class="btn" @click="addCurvePoint(dir)">加点</button>
            </div>
            <div class="table-wrap">
              <table class="data">
                <thead><tr><th>温度 ℃</th><th>收缩率</th><th></th></tr></thead>
                <tbody>
                  <tr v-for="(p, i) in draft[dir]" :key="i">
                    <td><input v-model.number="p.temp" type="number" class="input" /></td>
                    <td><input v-model.number="p.shrink" type="number" step="0.01" min="0" max="0.9" class="input" /></td>
                    <td><button class="btn btn-danger" :disabled="draft[dir].length <= 2" @click="draft[dir].splice(i, 1)">删</button></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
      <div class="modal-foot">
        <button class="btn" @click="editing = false">取消</button>
        <button class="btn btn-primary" @click="save">保存</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.film-card {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
  padding: var(--sp-3) var(--sp-4);
  border: 1px solid var(--c-100);
  border-radius: var(--radius);
  cursor: pointer;
}
.film-card:hover { background: var(--c-25); }
.film-card.active { border-color: var(--c-primary); background: var(--c-primary-soft); }
.sub { font-size: var(--fs-xs); color: var(--c-400); margin-top: 2px; }
.modal-mask {
  position: fixed; inset: 0; background: rgba(15,23,42,0.45);
  display: flex; align-items: center; justify-content: center; z-index: 50;
}
.modal { width: 880px; max-height: 86vh; display: flex; flex-direction: column; }
.modal-head { padding: var(--sp-4) var(--sp-5); border-bottom: 1px solid var(--c-100); }
.modal-body { padding: var(--sp-5); overflow: auto; }
.modal-foot { padding: var(--sp-4) var(--sp-5); border-top: 1px solid var(--c-100); display: flex; justify-content: flex-end; gap: var(--sp-3); }
.chart-legend { display: flex; gap: var(--sp-4); font-size: var(--fs-xs); color: var(--c-500); margin-top: var(--sp-2); }
.dot { width: 18px; height: 3px; border-radius: 2px; display: inline-block; margin-right: 6px; }
.dot.solid { background: var(--c-primary); }
.dot.dash { background: repeating-linear-gradient(90deg, var(--c-warn) 0 5px, transparent 5px 9px); }
</style>
