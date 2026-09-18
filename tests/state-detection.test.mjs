import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { analyzePatch, renderPatches } from '../src/patch-kit.mjs'

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'dsh-patch-state-'))
  mkdirSync(join(root, 'lib'), { recursive: true })
  writeFileSync(join(root, 'package.json'), '{"name":"fixture","version":"1.0.0","main":"lib/a.js"}\n')
  writeFileSync(join(root, 'lib/a.js'), 'const value = "old-a"\n')
  writeFileSync(join(root, 'lib/b.js'), 'const value = "old-b"\n')
  const packageMap = new Map([['fixture', {
    expected: { name: 'fixture' },
    root: { path: root },
    pkg: { path: root, value: { name: 'fixture', version: '1.0.0', main: 'lib/a.js' } },
  }]])
  const patch = {
    id: 'fixture-patch',
    targets: [{
      packageName: 'fixture',
      importSmoke: false,
      files: [
        { path: 'lib/a.js', edits: [{ before: 'old-a', after: 'new-a' }] },
        { path: 'lib/b.js', edits: [{ before: 'old-b', after: 'new-b' }] },
      ],
    }],
  }
  return { root, packageMap, patch }
}

test('classifies ready, applied, partial, and drifted states', () => {
  const { root, packageMap, patch } = fixture()
  assert.equal(analyzePatch(patch, packageMap).state, 'ready')

  writeFileSync(join(root, 'lib/a.js'), 'const value = "new-a"\n')
  assert.equal(analyzePatch(patch, packageMap).state, 'partial')

  writeFileSync(join(root, 'lib/b.js'), 'const value = "unknown"\n')
  assert.equal(analyzePatch(patch, packageMap).state, 'drifted')

  writeFileSync(join(root, 'lib/b.js'), 'const value = "new-b"\n')
  assert.equal(analyzePatch(patch, packageMap).state, 'applied')
})

test('render is idempotent after applying exact edits', () => {
  const { packageMap, patch } = fixture()
  const first = renderPatches([patch], packageMap)
  for (const output of first.values()) writeFileSync(output.path, output.content)
  assert.equal(analyzePatch(patch, packageMap).state, 'applied')
  const second = renderPatches([patch], packageMap)
  for (const output of second.values()) assert.equal(output.content, readFileSync(output.path, 'utf8'))
})
