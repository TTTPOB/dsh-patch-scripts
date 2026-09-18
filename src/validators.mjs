import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'

export function countOccurrences(text, fragment) {
  if (fragment.length === 0) throw new Error('empty patch fragment is not allowed')
  return text.split(fragment).length - 1
}

export function checkJavaScript(path) {
  const result = spawnSync(process.execPath, ['--check', path], { encoding: 'utf8' })
  if (result.status !== 0) throw new Error(`node --check failed for ${path}:\n${result.stderr}`)
}

export async function importSmoke(path) {
  const url = `${pathToFileURL(path).href}?dsh_patch_smoke=${Date.now()}-${Math.random()}`
  await import(url)
}

export function assertFileMarkers(path, present = [], absent = []) {
  const text = readFileSync(path, 'utf8')
  for (const marker of present) {
    if (!text.includes(marker)) throw new Error(`missing marker in ${path}: ${marker}`)
  }
  for (const marker of absent) {
    if (text.includes(marker)) throw new Error(`forbidden marker in ${path}: ${marker}`)
  }
}
