import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { countOccurrences, checkJavaScript, importSmoke } from './validators.mjs'
import { commitFiles, restoreBackupDir } from './transaction.mjs'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')

function safeName(name) {
  return name.replaceAll('@', '').replaceAll('/', '__')
}

function fileState(text, edit) {
  const before = countOccurrences(text, edit.before)
  const marker = edit.appliedMarker ?? edit.after
  const after = countOccurrences(text, marker)
  const count = edit.count ?? 1
  const markerCount = edit.appliedMarkerCount ?? count
  if (before === count) {
    if (edit.after.includes(edit.before) && after === markerCount) return 'applied'
    if (after === 0 || edit.allowMarkerWhileReady === true) return 'ready'
  }
  if (before === 0 && after === markerCount) return 'applied'
  return 'drifted'
}

function combineStates(states) {
  if (states.every(state => state === 'ready')) return 'ready'
  if (states.every(state => state === 'applied')) return 'applied'
  if (states.some(state => state === 'drifted')) return 'drifted'
  return 'partial'
}

export function analyzePatch(patch, packageMap) {
  const details = []
  for (const target of patch.targets) {
    const record = packageMap.get(target.packageName)
    if (record === undefined) throw new Error(`${patch.id}: package not resolved: ${target.packageName}`)
    for (const file of target.files) {
      const path = join(record.pkg.path, file.path)
      if (!existsSync(path)) {
        details.push({ path, state: 'drifted', reason: 'missing' })
        continue
      }
      const text = readFileSync(path, 'utf8')
      for (const edit of file.edits) details.push({ path, state: fileState(text, edit) })
    }
  }
  return { id: patch.id, state: combineStates(details.map(detail => detail.state)), details }
}

function applyEdit(text, edit, label) {
  const state = fileState(text, edit)
  if (state === 'applied') return text
  if (state !== 'ready') throw new Error(`${label}: replacement point is ${state}`)
  return text.replace(edit.before, edit.after)
}

export function renderPatches(patches, packageMap) {
  const outputs = new Map()
  for (const patch of patches) {
    for (const target of patch.targets) {
      const record = packageMap.get(target.packageName)
      if (record === undefined) throw new Error(`${patch.id}: package not resolved: ${target.packageName}`)
      for (const file of target.files) {
        const path = join(record.pkg.path, file.path)
        let text = outputs.get(path)?.content ?? readFileSync(path, 'utf8')
        for (const [index, edit] of file.edits.entries()) {
          text = applyEdit(text, edit, `${patch.id}:${file.path}:${index}`)
        }
        outputs.set(path, {
          path,
          content: text,
          mode: statSync(path).mode,
          label: `${safeName(target.packageName)}-${basename(file.path)}`,
        })
      }
    }
  }
  return outputs
}

function owningNodeModules(packagePath) {
  let current = resolve(packagePath)
  while (dirname(current) !== current) {
    if (basename(current) === 'node_modules') return current
    current = dirname(current)
  }
  return undefined
}

function clonePackages(packageMap, caseDir, targetNames) {
  const cloned = new Map()
  for (const name of targetNames) {
    const record = packageMap.get(name)
    if (record === undefined) throw new Error(`staged test package not resolved: ${name}`)
    const destination = join(caseDir, 'packages', safeName(name))
    cpSync(record.pkg.path, destination, {
      recursive: true,
      filter(source) {
        const leaf = basename(source)
        return leaf !== 'node_modules' && !leaf.startsWith('.local-patch-backup-')
      },
    })
    const dependencyRoot = owningNodeModules(record.pkg.path) ?? join(record.root.path, 'node_modules')
    if (existsSync(dependencyRoot)) symlinkSync(dependencyRoot, join(destination, 'node_modules'), 'dir')
    cloned.set(name, {
      ...record,
      pkg: {
        ...record.pkg,
        path: destination,
        realPath: destination,
        value: JSON.parse(readFileSync(join(destination, 'package.json'), 'utf8')),
      },
    })
  }
  return cloned
}

async function validateOutputs(patches, packageMap) {
  const jsFiles = new Set()
  const smokePackages = new Set()
  for (const patch of patches) {
    for (const target of patch.targets) {
      const record = packageMap.get(target.packageName)
      for (const file of target.files) {
        const path = join(record.pkg.path, file.path)
        if (path.endsWith('.js')) jsFiles.add(path)
      }
      if (target.importSmoke !== false) smokePackages.add(target.packageName)
    }
    if (patch.validate !== undefined) await patch.validate(packageMap)
  }
  for (const path of jsFiles) checkJavaScript(path)
  for (const name of smokePackages) {
    const record = packageMap.get(name)
    const main = record.pkg.value.main
    if (typeof main === 'string') await importSmoke(join(record.pkg.path, main))
  }
}

export async function stagedTest(deployment, patches, preflight, options = {}) {
  const runId = options.runId ?? `${Date.now()}-${process.pid}`
  const caseDir = resolve(projectRoot, '.patch-work/cases', runId)
  rmSync(caseDir, { recursive: true, force: true })
  mkdirSync(caseDir, { recursive: true })
  const targetNames = new Set(patches.flatMap(patch => patch.targets.map(target => target.packageName)))
  const cloned = clonePackages(preflight.packages, caseDir, targetNames)
  const outputs = renderPatches(patches, cloned)
  for (const output of outputs.values()) writeFileSync(output.path, output.content, { mode: output.mode })
  await validateOutputs(patches, cloned)
  const states = patches.map(patch => analyzePatch(patch, cloned))
  if (states.some(state => state.state !== 'applied')) {
    throw new Error(`staged patch validation failed: ${JSON.stringify(states)}`)
  }
  if (!options.keepWork) rmSync(caseDir, { recursive: true, force: true })
  return { caseDir, states }
}

export async function applyPatches(deployment, patches, preflight, options = {}) {
  const states = patches.map(patch => analyzePatch(patch, preflight.packages))
  const invalid = states.filter(state => !['ready', 'applied'].includes(state.state))
  if (invalid.length > 0) throw new Error(`refusing apply: ${invalid.map(value => `${value.id}=${value.state}`).join(', ')}`)
  await stagedTest(deployment, patches, preflight)
  const outputs = renderPatches(patches, preflight.packages)
  const stamp = new Date().toISOString().replaceAll(':', '').replaceAll('.', '')
  const backupDir = resolve(projectRoot, '.patch-work/backups', `${stamp}-${deployment.id}`)
  const result = commitFiles([...outputs.values()], backupDir, options.transaction)
  try {
    await validateOutputs(patches, preflight.packages)
    const finalStates = patches.map(patch => analyzePatch(patch, preflight.packages))
    if (finalStates.some(state => state.state !== 'applied')) throw new Error('post-apply patch state validation failed')
    return { ...result, states: finalStates }
  } catch (error) {
    restoreBackupDir(backupDir)
    throw error
  }
}

export function patchStates(patches, packageMap) {
  return patches.map(patch => analyzePatch(patch, packageMap))
}

export { projectRoot }
