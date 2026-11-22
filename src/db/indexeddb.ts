// IndexedDB 轻封装：单库多对象仓，id 为主键
const DB_NAME = 'sleeve-workbench'
const DB_VERSION = 1

export const STORES = [
  'bottles',
  'films',
  'furnaces',
  'artworks',
  'projects',
  'corrections',
] as const

export type StoreName = (typeof STORES)[number]

let dbPromise: Promise<IDBDatabase> | null = null

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      for (const name of STORES) {
        if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, { keyPath: 'id' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return dbPromise
}

function tx<T>(store: StoreName, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(store, mode)
        const req = fn(t.objectStore(store))
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(req.error)
      }),
  )
}

export interface PersistEntity {
  id: string
  updatedAt?: number
}

export async function getAll<T>(store: StoreName): Promise<T[]> {
  return tx(store, 'readonly', (s) => s.getAll() as IDBRequest<T[]>)
}

export async function getById<T>(store: StoreName, id: string): Promise<T | undefined> {
  return tx(store, 'readonly', (s) => s.get(id) as IDBRequest<T | undefined>)
}

export async function put<T extends PersistEntity>(store: StoreName, entity: T): Promise<T> {
  const stamped = { ...entity, updatedAt: Date.now() }
  await tx(store, 'readwrite', (s) => s.put(stamped) as IDBRequest<IDBValidKey>)
  return stamped
}

export async function remove(store: StoreName, id: string): Promise<void> {
  await tx(store, 'readwrite', (s) => s.delete(id) as IDBRequest<undefined>)
}

export async function bulkPut<T extends PersistEntity>(store: StoreName, items: T[]): Promise<void> {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const t = db.transaction(store, 'readwrite')
    const s = t.objectStore(store)
    for (const item of items) s.put({ ...item, updatedAt: Date.now() })
    t.oncomplete = () => resolve()
    t.onerror = () => reject(t.error)
  })
}

export function uid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}
