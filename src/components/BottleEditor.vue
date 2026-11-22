<script setup lang="ts">
import { reactive, watch } from 'vue'
import type { BottleProfile, CrossSection, ProfilePoint } from '@/core/types'
import { uid } from '@/db/indexeddb.ts'

const props = defineProps<{ modelValue: boolean; initial: BottleProfile | null }>()
const emit = defineEmits<{
  'update:modelValue': [v: boolean]
  save: [b: BottleProfile]
}>()

const draft = reactive<BottleProfile>(blank())

watch(
  () => props.modelValue,
  (open) => {
    if (open) Object.assign(draft, props.initial ? structuredClone(props.initial) : blank())
  },
)

function blank(): BottleProfile {
  return {
    id: uid('bottle'),
    name: '新瓶型',
    height: 200,
    labelZMin: 20,
    labelZMax: 160,
    section: { type: 'circle' },
    points: [
      { z: 0, r: 30 },
      { z: 120, r: 30 },
      { z: 150, r: 16 },
      { z: 200, r: 16 },
    ],
    updatedAt: Date.now(),
  }
}

function close() {
  emit('update:modelValue', false)
}
function save() {
  draft.points.sort((a, b) => a.z - b.z)
  emit('save', structuredClone(draft))
  close()
}
function addPoint() {
  draft.points.push({ z: draft.height, r: draft.points.at(-1)?.r ?? 15 })
}
function removePoint(i: number) {
  draft.points.splice(i, 1)
}
function setSection(type: CrossSection['type']) {
  if (type === 'circle') draft.section = { type: 'circle' }
  if (type === 'ellipse') draft.section = { type: 'ellipse', depthRatio: 0.7 }
  if (type === 'rounded-rect') draft.section = { type: 'rounded-rect', depthRatio: 0.7, cornerRatio: 0.15 }
}

// 非圆截面参数的类型化双向绑定访问器
function getDepthRatio(): number {
  return draft.section.type === 'circle' ? 1 : draft.section.depthRatio
}
function setDepthRatio(v: number) {
  if (draft.section.type === 'circle') return
  draft.section.depthRatio = v
}
function getCornerRatio(): number {
  return draft.section.type === 'rounded-rect' ? draft.section.cornerRatio : 0
}
function setCornerRatio(v: number) {
  if (draft.section.type !== 'rounded-rect') return
  draft.section.cornerRatio = v
}
function importPoints(evt: Event) {
  const input = evt.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => {
    try {
      const rows = String(reader.result)
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean)
        .map((l) => l.split(/[,\s]+/).map(Number))
        .filter((v) => v.length >= 2 && v.every(Number.isFinite))
        .map(([z, r]): ProfilePoint => ({ z, r }))
      if (rows.length >= 2) draft.points = rows
    } catch {
      // 解析失败保持原数据
    }
  }
  reader.readAsText(file)
  input.value = ''
}
</script>

<template>
  <div v-if="modelValue" class="modal-mask" @click.self="close">
    <div class="modal card">
      <div class="modal-head">
        <h2 class="text-base">{{ initial ? '编辑瓶型' : '新建瓶型' }}</h2>
      </div>
      <div class="modal-body grid grid-cols-2 gap-6">
        <div>
          <label class="label">名称</label>
          <input v-model="draft.name" class="input mb-4" />
          <div class="grid grid-cols-3 gap-3 mb-4">
            <div>
              <label class="label">瓶高 mm</label>
              <input v-model.number="draft.height" type="number" class="input" />
            </div>
            <div>
              <label class="label">标签底 z</label>
              <input v-model.number="draft.labelZMin" type="number" class="input" />
            </div>
            <div>
              <label class="label">标签顶 z</label>
              <input v-model.number="draft.labelZMax" type="number" class="input" />
            </div>
          </div>
          <label class="label">截面类型</label>
          <div class="flex gap-2 mb-4">
            <button class="btn" :class="{ 'btn-primary': draft.section.type === 'circle' }" @click="setSection('circle')">圆截面</button>
            <button class="btn" :class="{ 'btn-primary': draft.section.type === 'ellipse' }" @click="setSection('ellipse')">椭圆</button>
            <button class="btn" :class="{ 'btn-primary': draft.section.type === 'rounded-rect' }" @click="setSection('rounded-rect')">圆角矩形</button>
          </div>
          <div v-if="draft.section.type !== 'circle'" class="grid grid-cols-2 gap-3 mb-4">
            <div>
              <label class="label">深宽比</label>
              <input :value="getDepthRatio()" @input="setDepthRatio(Number(($event.target as HTMLInputElement).value))"
                type="number" step="0.02" min="0.3" max="1" class="input" />
            </div>
            <div v-if="draft.section.type === 'rounded-rect'">
              <label class="label">圆角比</label>
              <input :value="getCornerRatio()" @input="setCornerRatio(Number(($event.target as HTMLInputElement).value))"
                type="number" step="0.01" min="0.05" max="0.5" class="input" />
            </div>
          </div>
          <label class="label">轮廓点导入（CSV：z,r 每行一对）</label>
          <label class="btn mb-4 cursor-pointer">
            选择文件
            <input type="file" accept=".csv,.txt" class="hidden" @change="importPoints" />
          </label>
        </div>
        <div>
          <div class="flex items-center justify-between mb-2">
            <label class="label mb-0">母线控制点</label>
            <button class="btn" @click="addPoint">加点</button>
          </div>
          <div class="table-wrap" style="max-height: 320px">
            <table class="data">
              <thead><tr><th>z mm</th><th>r mm</th><th></th></tr></thead>
              <tbody>
                <tr v-for="(p, i) in draft.points" :key="i">
                  <td><input v-model.number="p.z" type="number" class="input" /></td>
                  <td><input v-model.number="p.r" type="number" class="input" /></td>
                  <td>
                    <button class="btn btn-danger" :disabled="draft.points.length <= 2" @click="removePoint(i)">删</button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <div class="modal-foot">
        <button class="btn" @click="close">取消</button>
        <button class="btn btn-primary" @click="save">保存</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal-mask {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 50;
}
.modal {
  width: 860px;
  max-height: 86vh;
  display: flex;
  flex-direction: column;
}
.modal-head {
  padding: var(--sp-4) var(--sp-5);
  border-bottom: 1px solid var(--c-100);
}
.modal-body {
  padding: var(--sp-5);
  overflow: auto;
}
.modal-foot {
  padding: var(--sp-4) var(--sp-5);
  border-top: 1px solid var(--c-100);
  display: flex;
  justify-content: flex-end;
  gap: var(--sp-3);
}
.hidden {
  display: none;
}
</style>
