import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import YAML from 'yaml'
import { preflightDeployment } from '../src/preflight.mjs'
import { resolvePackage } from '../src/package-resolver.mjs'

function baseline(specifier = '1.2.3') {
  const root = mkdtempSync(join(tmpdir(), 'dsh-patch-preflight-'))
  const packageDir = join(root, 'node_modules/example')
  mkdirSync(packageDir, { recursive: true })
  writeFileSync(join(root, 'package.json'), `${JSON.stringify({
    name: 'fixture-root', private: true, dependencies: { example: specifier },
  })}\n`)
  writeFileSync(join(packageDir, 'package.json'), '{"name":"example","version":"1.2.3","main":"index.js"}\n')
  writeFileSync(join(packageDir, 'index.js'), 'export const ok = true\n')
  const lock = {
    lockfileVersion: '9.0',
    importers: { '.': { dependencies: { example: { specifier, version: '1.2.3' } } } },
    packages: { 'example@1.2.3': { resolution: { integrity: 'sha512-test' } } },
  }
  writeFileSync(join(root, 'pnpm-lock.yaml'), YAML.stringify(lock))
  return root
}

function deployment(root, version = '1.2.3') {
  return {
    id: 'fixture', dshVersion: 'none', checkCli: false, officialOnly: true,
    roots: { profile: { path: root, importer: '.' } },
    packages: [{ root: 'profile', name: 'example', version, direct: true }],
    patches: [],
  }
}

test('resolves a direct package and accepts exact official versions', () => {
  const root = baseline()
  const resolved = resolvePackage(root, 'example')
  assert.equal(resolved.value.version, '1.2.3')
  assert.equal(resolved.direct, true)
  assert.equal(preflightDeployment(deployment(root)).ok, true)
})

test('rejects version mismatch', () => {
  const result = preflightDeployment(deployment(baseline(), '1.2.4'))
  assert.equal(result.ok, false)
  assert.match(result.errors.join('\n'), /expected 1\.2\.4, got 1\.2\.3/)
})

test('rejects non-registry manifest and lockfile sources', () => {
  const result = preflightDeployment(deployment(baseline('https://example.test/fork.tgz')))
  assert.equal(result.ok, false)
  assert.match(result.errors.join('\n'), /non-registry specifier/)
})
