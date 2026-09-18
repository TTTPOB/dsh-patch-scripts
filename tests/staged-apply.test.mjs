import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { stagedTest } from '../src/patch-kit.mjs'

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'dsh-patch-staged-'))
  const packageDir = join(root, 'node_modules/fixture')
  mkdirSync(join(packageDir, 'lib'), { recursive: true })
  writeFileSync(join(root, 'package.json'), '{"name":"root","private":true}\n')
  writeFileSync(join(packageDir, 'package.json'), '{"name":"fixture","version":"1.0.0","type":"module","main":"lib/index.js"}\n')
  writeFileSync(join(packageDir, 'lib/index.js'), 'export const value = "before"\n')
  const record = {
    expected: { name: 'fixture' }, root: { path: root },
    pkg: { path: packageDir, value: { name: 'fixture', version: '1.0.0', main: 'lib/index.js' } },
  }
  const patch = {
    id: 'fixture',
    targets: [{ packageName: 'fixture', files: [{
      path: 'lib/index.js', edits: [{ before: '"before"', after: '"after"' }],
    }] }],
  }
  return { root, packageDir, patch, preflight: { packages: new Map([['fixture', record]]) } }
}

test('staged test patches a copy without modifying installed files', async () => {
  const value = fixture()
  const result = await stagedTest({ id: 'fixture' }, [value.patch], value.preflight, { keepWork: true })
  assert.equal(readFileSync(join(value.packageDir, 'lib/index.js'), 'utf8'), 'export const value = "before"\n')
  assert.equal(result.states[0].state, 'applied')
  assert.match(readFileSync(join(result.caseDir, 'packages/fixture/lib/index.js'), 'utf8'), /"after"/)
  rmSync(result.caseDir, { recursive: true, force: true })
})
