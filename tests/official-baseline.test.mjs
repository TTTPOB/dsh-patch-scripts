import test from 'node:test'
import assert from 'node:assert/strict'
import deployment from '../deployments/official-0.1.5-rc.2.mjs'
import { preflightDeployment } from '../src/preflight.mjs'
import { stagedTest, patchStates } from '../src/patch-kit.mjs'
import { readFileSync } from 'node:fs'
import { selectPatches } from '../patches/index.mjs'
import { profilePackages, sharedPackages } from '../deployments/package-set.mjs'

test('baseline dependencies exactly match the intended package set', () => {
  const manifest = JSON.parse(readFileSync(new URL('../baselines/dsh-0.1.5-rc.2/package.json', import.meta.url), 'utf8'))
  const intended = Object.fromEntries([...sharedPackages, ...profilePackages])
  assert.deepEqual(manifest.dependencies, intended)
})

test('all patches apply to an untouched official 0.1.5-rc.2 baseline', async () => {
  const preflight = preflightDeployment(deployment)
  assert.deepEqual(preflight.errors, [])
  const patches = selectPatches(deployment.patches)
  assert.deepEqual(patchStates(patches, preflight.packages).map(value => value.state), patches.map(() => 'ready'))
  const result = await stagedTest(deployment, patches, preflight)
  assert.deepEqual(result.states.map(value => value.state), patches.map(() => 'applied'))
})
