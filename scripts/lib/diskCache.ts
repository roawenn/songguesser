import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'

const CACHE_DIR = '.cache'

interface Entry<T> {
  at: number
  data: T
}

function pathFor(namespace: string, key: string): string {
  const hash = createHash('sha1').update(key).digest('hex')
  return join(CACHE_DIR, namespace, `${hash}.json`)
}

/**
 * Kalıcı disk cache. Küratör listeye 5 şarkı ekleyip yeniden çalıştırdığında
 * yalnızca o 5'i ağdan çeker — artımlı build'ler neredeyse bedava.
 */
export async function cached<T>(
  namespace: string,
  key: string,
  ttlMs: number,
  produce: () => Promise<T>,
): Promise<T> {
  const file = pathFor(namespace, key)
  if (existsSync(file)) {
    try {
      const entry = JSON.parse(readFileSync(file, 'utf8')) as Entry<T>
      if (Date.now() - entry.at < ttlMs) return entry.data
    } catch {
      // bozuk cache girdisi — yeniden üret
    }
  }
  const data = await produce()
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, JSON.stringify({ at: Date.now(), data } satisfies Entry<T>))
  return data
}

export const WEEK = 7 * 24 * 60 * 60 * 1000
export const DAY = 24 * 60 * 60 * 1000
