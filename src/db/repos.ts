import { getAll, put, bulkPut } from './indexeddb.ts'
import type { BottleProfile, FilmBatch, FurnaceProfile } from '@/core/types'
import { makeSampleBottles } from '@/core/sample_bottles'
import { makeSampleFilms } from '@/core/sample_films'
import { makeSampleFurnaces } from '@/core/sample_furnaces'

// 首次启动注入种子数据
export async function seedIfEmpty(): Promise<void> {
  const bottles = await getAll<BottleProfile>('bottles')
  if (bottles.length === 0) await bulkPut('bottles', makeSampleBottles())
  const films = await getAll<FilmBatch>('films')
  if (films.length === 0) await bulkPut('films', makeSampleFilms())
  const furnaces = await getAll<FurnaceProfile>('furnaces')
  if (furnaces.length === 0) await bulkPut('furnaces', makeSampleFurnaces())
}

export const bottleRepo = {
  list: () => getAll<BottleProfile>('bottles'),
  save: (b: BottleProfile) => put('bottles', b),
}
export const filmRepo = {
  list: () => getAll<FilmBatch>('films'),
  save: (f: FilmBatch) => put('films', f),
}
export const furnaceRepo = {
  list: () => getAll<FurnaceProfile>('furnaces'),
  save: (f: FurnaceProfile) => put('furnaces', f),
}
