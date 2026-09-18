import test from 'node:test'
import assert from 'node:assert/strict'
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import YAML from 'yaml'
import { resolveDshInstallation } from '../src/package-resolver.mjs'
import { preflightDeployment } from '../src/preflight.mjs'
import { prepareSupport, supportArguments } from '../src/prepare-support.mjs'

function writePackage(path, name, version = '1.0.0') {
  mkdirSync(path, { recursive: true })
  writeFileSync(join(path, 'package.json'), `${JSON.stringify({ name, version, type: 'module', main: 'index.js' })}\n`)
  writeFileSync(join(path, 'index.js'), 'export const ok = true\n')
}

function packagePath(root, name) {
  return join(root, 'node_modules', ...name.split('/'))
}

function installationFixture() {
  const root = mkdtempSync(join(tmpdir(), 'dsh-patch-installation-'))
  const store = join(root, 'store')
  const dsh = join(store, 'dsh')
  writePackage(dsh, '@deepseek-ai/dsh', '0.1.5-rc.2')
  mkdirSync(join(dsh, 'lib'), { recursive: true })
  writeFileSync(join(dsh, 'lib/bin.js'), '#!/usr/bin/env node\n')
  mkdirSync(dirname(packagePath(root, '@deepseek-ai/dsh')), { recursive: true })
  symlinkSync(dsh, packagePath(root, '@deepseek-ai/dsh'), 'dir')
  writeFileSync(join(root, 'package.json'), '{"private":true,"dependencies":{"@deepseek-ai/dsh":"0.1.5-rc.2"}}\n')
  const bin = join(root, 'bin/dsh')
  mkdirSync(dirname(bin), { recursive: true })
  writeFileSync(bin, `#!/bin/sh\n# cmd-shim-target=${packagePath(root, '@deepseek-ai/dsh')}/lib/bin.js\n`)
  return { root, dsh, bin }
}

test('locates the installation project from the active pnpm shim', () => {
  const value = installationFixture()
  const installation = resolveDshInstallation({ dshBin: value.bin })
  assert.equal(installation.projectRoot, value.root)
  assert.equal(installation.dsh.realPath, value.dsh)
})

test('accepts an explicit installation project override', () => {
  const value = installationFixture()
  const installation = resolveDshInstallation({ root: value.root })
  assert.equal(installation.projectRoot, value.root)
  assert.equal(installation.dsh.value.version, '0.1.5-rc.2')
})

test('support preparation pins exact packages in the installation project', () => {
  const deployment = {
    installation: { projectRoot: '/installation' },
    packages: [
      { name: '@modelcontextprotocol/client', version: '2.0.0', support: true },
      { name: '@modelcontextprotocol/core', version: '2.0.0', support: true },
    ],
  }
  assert.deepEqual(supportArguments(deployment), [
    'pnpm@11.24.0', '--dir', '/installation', 'add', '--save-exact',
    '@modelcontextprotocol/client@2.0.0', '@modelcontextprotocol/core@2.0.0',
  ])
  let call
  prepareSupport(deployment, { spawnSync(command, args) { call = [command, args]; return { status: 0 } } })
  assert.deepEqual(call, ['corepack', supportArguments(deployment)])
})

function resolutionFixture() {
  const root = mkdtempSync(join(tmpdir(), 'dsh-patch-resolution-'))
  const anchor = join(root, 'anchor')
  writePackage(anchor, '@deepseek-ai/dsh')
  const owner = packagePath(anchor, '@deepseek-ai/owner')
  const expectedDependency = packagePath(anchor, '@scope/dependency')
  writePackage(owner, '@deepseek-ai/owner')
  writePackage(expectedDependency, '@scope/dependency')
  writeFileSync(join(root, 'package.json'), '{"private":true,"dependencies":{"@scope/dependency":"1.0.0"}}\n')
  const lock = {
    lockfileVersion: '9.0',
    importers: { '.': { dependencies: { '@scope/dependency': { specifier: '1.0.0', version: '1.0.0' } } } },
    packages: { '@deepseek-ai/owner@1.0.0': {}, '@scope/dependency@1.0.0': {} },
  }
  writeFileSync(join(root, 'pnpm-lock.yaml'), YAML.stringify(lock))
  const deployment = {
    checkCli: false,
    officialOnly: true,
    roots: { installation: { path: anchor, manifestPath: root, lockPath: root, importer: '.' } },
    packages: [
      { root: 'installation', name: '@deepseek-ai/owner', version: '1.0.0', checkManifest: false },
      { root: 'installation', name: '@scope/dependency', version: '1.0.0', checkManifest: true },
    ],
    patchDependencies: [{ from: '@deepseek-ai/owner', packageName: '@scope/dependency' }],
  }
  return { root, anchor, owner, expectedDependency, deployment }
}

test('verifies that a patch owner resolves the exact package being patched', () => {
  const value = resolutionFixture()
  assert.deepEqual(preflightDeployment(value.deployment).errors, [])
  writePackage(packagePath(value.owner, '@scope/dependency'), '@scope/dependency')
  const result = preflightDeployment(value.deployment)
  assert.match(result.errors.join('\n'), /not patched package/)
})

test('reports profile shadow packages with the reconciliation command', () => {
  const value = resolutionFixture()
  const profile = join(value.root, 'profile')
  mkdirSync(profile, { recursive: true })
  writeFileSync(join(profile, 'package.json'), '{"dependencies":{"@scope/dependency":"1.0.0","personal-plugin":"1.0.0"}}\n')
  value.deployment.shadowProfiles = [{ name: 'web', path: profile, packages: ['@scope/dependency'] }]
  const result = preflightDeployment(value.deployment)
  assert.match(result.errors.join('\n'), /dsh plugin --profile web remove @scope\/dependency/)
  assert.doesNotMatch(result.errors.join('\n'), /personal-plugin/)
  assert.match(readFileSync(join(profile, 'package.json'), 'utf8'), /personal-plugin/)
})
