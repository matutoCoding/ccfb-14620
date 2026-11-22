<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import type { BottleProfile, FilmBatch, HeightAnalysisRow } from '@/core/types'
import { buildBottleGeometry, markOverLimit } from '@/core/geometry'
import { bottleRepo, filmRepo } from '@/db/repos.ts'
import { remove } from '@/db/indexeddb.ts'
import { store } from '@/state/store.ts'
import BottleProfileView from '@/components/BottleProfileView.vue'
import BottleEditor from '@/components/BottleEditor.vue'
import EmptyState from '@/components/EmptyState.vue'
import { iconBottle, iconPlus, iconTrash, iconWarning } from '@/components/icons.ts'

const bottles = ref<BottleProfile[]>([])
const films = ref<FilmBatch[]>([])
const selectedId = ref<string>('')
const editorOpen = ref(false)
const editing = ref<BottleProfile | null>(null)
const filterFilmId = ref<string>('')

async function load() {
  bottles.value = await bottleRepo.list()
  films.value = await filmRepo.list()
  if (!selectedId.value && bottles.value.length) selectedId.value = bottles.value[0].id
}
onMounted(load)

const selected = computed(() => bottles.value.find((b) => b.id === selectedId.value) ?? null)
const filterFilm = computed(() => films.value.find((f) => f.id === filterFilmId.value) ?? null)
const geometry = computed(() => (selected.value ? buildBottleGeometry(selected.value) : null))
const analysis = computed<HeightAnalysisRow[]>(() => {
  if (!geometry.value) return []
  if (!filterFilm.value) return geometry.value.analysis
  return markOverLimit(geometry.value, filterFilm.value.tdLimit)
})
const overLimitRows = computed(() => analysis.value.filter((r) => r.overLimit))
const tableRows = computed(() => analysis.value.filter((_, i) => i % 4 === 0))

function openCreate() {
  editing.value = null
  editorOpen.value = true
}
function openEdit(b: BottleProfile) {
  editing.value = b
  editorOpen.value = true
}
async function onSave(b: BottleProfile) {
  await bottleRepo.save(b)
  selectedId.value = b.id
  await load()
}
async function onDelete(b: BottleProfile) {
  await remove('bottles', b.id)
  if (selectedId.value === b.id) selectedId.value = ''
  await load()
}
function useBottle(b: BottleProfile) {
  store.bottle = b
}
</script>

<template>
  <div v-if="!bottles.length" class="max-w-lg">
    <EmptyState :icon="iconBottle" title="还没有瓶型" subtitle="新建一个瓶型，或从内置测试瓶型开始">
      <button class="btn btn-primary" @click="openCreate">新建瓶型</button>
    </EmptyState>
  </div>

  <div v-else class="grid gap-6" style="grid-template-columns: 340px 1fr">
    <div class="card p-4 h-fit">
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-base">瓶型列表</h2>
        <button class="btn btn-primary" @click="openCreate">
          <span v-html="iconPlus(16)"></span>新建
        </button>
      </div>
      <div class="flex flex-col gap-2">
        <div
          v-for="b in bottles"
          :key="b.id"
          class="bottle-card"
          :class="{ active: b.id === selectedId }"
          @click="selectedId = b.id"
        >
          <div class="flex-1">
            <div class="font-medium">{{ b.name }}</div>
            <div class="sub">
              {{ b.section.type === 'circle' ? '回转圆瓶' : b.section.type === 'ellipse' ? '椭圆截面' : '圆角方瓶' }}
              · 高 {{ b.height }}mm
            </div>
          </div>
          <div class="flex gap-1" @click.stop>
            <button class="btn" @click="openEdit(b)">编辑</button>
            <button class="btn btn-danger" @click="onDelete(b)"><span v-html="iconTrash(16)"></span></button>
          </div>
        </div>
      </div>
    </div>

    <div v-if="selected && geometry" class="flex flex-col gap-6">
      <div class="card p-5">
        <div class="flex items-start justify-between mb-4">
          <div>
            <h2 class="text-base mb-1">{{ selected.name }}</h2>
            <div class="flex gap-2 items-center">
              <span class="tag">最大周长 {{ geometry.maxPerimeter.toFixed(1) }} mm</span>
              <span class="tag">母线点 {{ selected.points.length }}</span>
              <span v-if="store.bottle?.id === selected.id" class="tag tag-ok">已选为当前瓶型</span>
            </div>
          </div>
          <div class="flex gap-2">
            <select v-model="filterFilmId" class="select" style="width: 200px">
              <option value="">不校验膜材极限</option>
              <option v-for="f in films" :key="f.id" :value="f.id">{{ f.name }} 极限 {{ (f.tdLimit * 100).toFixed(0) }}%</option>
            </select>
            <button class="btn btn-primary" @click="useBottle(selected)">用于仿真</button>
          </div>
        </div>
        <div class="flex gap-6">
          <BottleProfileView :geo="geometry" :td-limit="filterFilm?.tdLimit ?? null" />
          <div class="flex-1">
            <div v-if="overLimitRows.length" class="alert-danger mb-4">
              <span v-html="iconWarning(18)"></span>
              <div>
                <div class="font-medium">{{ overLimitRows.length }} 个高度带超出膜材极限收缩率</div>
                <div class="sub">区间 z={{ overLimitRows[0].z.toFixed(1) }} ~ {{ overLimitRows.at(-1)!.z.toFixed(1) }}mm，
                  峰值需求 {{ (Math.max(...overLimitRows.map((r) => r.requiredShrink)) * 100).toFixed(1) }}%</div>
              </div>
            </div>
            <h3 class="text-sm font-semibold mb-2">逐高度周长与需求收缩率</h3>
            <div class="table-wrap" style="max-height: 300px">
              <table class="data">
                <thead><tr><th>高度 z mm</th><th>周长 mm</th><th>半径 mm</th><th>需求收缩率</th><th>状态</th></tr></thead>
                <tbody>
                  <tr v-for="row in tableRows" :key="row.z">
                    <td>{{ row.z.toFixed(1) }}</td>
                    <td>{{ row.perimeter.toFixed(1) }}</td>
                    <td>{{ row.radius.toFixed(1) }}</td>
                    <td>{{ (row.requiredShrink * 100).toFixed(1) }}%</td>
                    <td>
                      <span v-if="row.overLimit" class="tag tag-danger">超限</span>
                      <span v-else class="tag tag-ok">可行</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <BottleEditor v-model="editorOpen" :initial="editing" @save="onSave" />
</template>

<style scoped>
.bottle-card {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
  padding: var(--sp-3) var(--sp-4);
  border: 1px solid var(--c-100);
  border-radius: var(--radius);
  cursor: pointer;
  transition: border-color var(--t-fast), background var(--t-fast);
}
.bottle-card:hover {
  background: var(--c-25);
}
.bottle-card.active {
  border-color: var(--c-primary);
  background: var(--c-primary-soft);
}
.sub {
  font-size: var(--fs-xs);
  color: var(--c-400);
  margin-top: 2px;
}
.alert-danger {
  display: flex;
  gap: var(--sp-3);
  padding: var(--sp-3) var(--sp-4);
  background: var(--c-danger-soft);
  border: 1px solid #fecaca;
  border-radius: var(--radius);
  color: var(--c-danger);
  align-items: flex-start;
}
</style>
