<script setup lang="ts">
defineProps<{
  icon: (size?: number) => string
  title: string
  subtitle: string
}>()
</script>

<template>
  <div class="empty-state card">
    <div class="empty-icon" v-html="icon(28)"></div>
    <div class="empty-title">{{ title }}</div>
    <div class="empty-sub">{{ subtitle }}</div>
    <slot />
  </div>
</template>

<style scoped>
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: var(--sp-7) var(--sp-6);
  text-align: center;
}
.empty-icon {
  width: 56px;
  height: 56px;
  border-radius: var(--radius-lg);
  background: var(--c-50);
  border: 1px solid var(--c-100);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--c-400);
  margin-bottom: var(--sp-4);
}
.empty-title {
  font-size: var(--fs-base);
  font-weight: var(--fw-semibold);
  color: var(--c-700);
  margin-bottom: var(--sp-1);
}
.empty-sub {
  font-size: var(--fs-xs);
  color: var(--c-400);
  margin-bottom: var(--sp-4);
}
</style>
