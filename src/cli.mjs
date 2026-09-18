#!/usr/bin/env node
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { applyPatches, patchStates, stagedTest } from './patch-kit.mjs'
import { preflightDeployment } from './preflight.mjs'
import { restoreBackupDir } from './transaction.mjs'
import { prepareSupport } from './prepare-support.mjs'
import { patchRegistry, selectPatches } from '../patches/index.mjs'

function usage() {
  console.error('Usage: node src/cli.mjs <list|prepare-support|doctor|status|test|apply|restore> [--deployment id] [--patch id] [--keep-work] [--backup dir]')
  process.exit(2)
}

function parse(argv) {
  const [command, ...rest] = argv
  if (command === undefined) usage()
  const result = { command, patches: [], keepWork: false }
  for (let index = 0; index < rest.length; index += 1) {
    const arg = rest[index]
    if (arg === '--deployment') result.deployment = rest[++index]
    else if (arg === '--patch') result.patches.push(rest[++index])
    else if (arg === '--backup') result.backup = rest[++index]
    else if (arg === '--keep-work') result.keepWork = true
    else usage()
  }
  return result
}

async function loadDeployment(id) {
  if (!/^[a-z0-9.-]+$/.test(id)) throw new Error(`invalid deployment id: ${id}`)
  const path = resolve(new URL('../deployments/', import.meta.url).pathname, `${id}.mjs`)
  if (!existsSync(path)) throw new Error(`unknown deployment: ${id}`)
  const module = await import(pathToFileURL(path))
  if (module.default.retired !== undefined) throw new Error(`${id}: ${module.default.retired}`)
  return module.default
}

function printPreflight(deployment, result) {
  console.log(`Deployment: ${deployment.id}`)
  if (deployment.installation !== undefined) {
    console.log(`Installation: ${deployment.installation.projectRoot}`)
  }
  if (result.cli !== undefined) {
    console.log(`DSH: ${result.cli.version} (${result.cli.path})`)
  } else if (!deployment.checkCli) {
    console.log('DSH CLI: skipped for official package baseline')
  }
  console.log('Packages:')
  for (const expected of deployment.packages) {
    const record = result.packages.get(expected.name)
    if (record === undefined) console.log(`  FAIL ${expected.root.padEnd(7)} ${expected.name} (unresolved)`)
    else {
      const ok = record.pkg.value.version === expected.version && (!expected.direct || record.pkg.direct)
      console.log(`  ${ok ? 'OK  ' : 'FAIL'} ${expected.root.padEnd(7)} ${expected.name} ${record.pkg.value.version} -> ${record.pkg.realPath}`)
    }
  }
  if (result.errors.length > 0) {
    console.log('Errors:')
    for (const error of result.errors) console.log(`  - ${error}`)
  }
}

async function main() {
  const options = parse(process.argv.slice(2))
  if (options.command === 'list') {
    for (const patch of patchRegistry.values()) console.log(`${patch.id}\t${patch.description}`)
    return
  }
  if (options.command === 'restore') {
    if (options.backup === undefined) usage()
    const files = restoreBackupDir(resolve(options.backup))
    console.log(`Restored ${files.length} files from ${resolve(options.backup)}`)
    return
  }
  const deployment = await loadDeployment(options.deployment ?? 'installation-0.1.5-rc.2')
  if (options.command === 'prepare-support') {
    const result = prepareSupport(deployment)
    console.log(`Prepared exact support dependencies in ${result.projectRoot}`)
    console.log(`Next: node src/cli.mjs doctor --deployment ${deployment.id}`)
    return
  }
  const patchIds = options.patches.length > 0 ? options.patches : deployment.patches
  const patches = selectPatches(patchIds)
  const preflight = preflightDeployment(deployment)
  printPreflight(deployment, preflight)
  if (!preflight.ok) throw new Error('preflight failed')
  const states = patchStates(patches, preflight.packages)
  console.log('Patches:')
  for (const state of states) console.log(`  ${state.state.toUpperCase().padEnd(8)} ${state.id}`)
  if (states.some(state => ['partial', 'drifted'].includes(state.state))) {
    throw new Error('patch state is partial or drifted')
  }
  if (options.command === 'doctor' || options.command === 'status') return
  if (options.command === 'test') {
    const result = await stagedTest(deployment, patches, preflight, { keepWork: options.keepWork })
    console.log(`Staged test passed${options.keepWork ? `: ${result.caseDir}` : ''}`)
    return
  }
  if (options.command === 'apply') {
    const result = await applyPatches(deployment, patches, preflight)
    console.log(`Applied ${result.files.length} files. Backup: ${result.backupDir}`)
    console.log('Restart DSH externally before testing new conversations.')
    return
  }
  usage()
}

main().catch(error => {
  console.error(`ERROR: ${error.message}`)
  process.exitCode = 1
})
