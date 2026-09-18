import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { commitFiles, restoreBackupDir } from '../src/transaction.mjs'

function setup() {
  const root = mkdtempSync(join(tmpdir(), 'dsh-patch-transaction-'))
  const a = join(root, 'a.js')
  const b = join(root, 'b.js')
  writeFileSync(a, 'old-a\n')
  writeFileSync(b, 'old-b\n')
  return { root, a, b }
}

test('rolls back previously committed files when a later commit fails', () => {
  const { root, a, b } = setup()
  assert.throws(() => commitFiles([
    { path: a, content: 'new-a\n', mode: 0o100644, label: 'a.js' },
    { path: b, content: 'new-b\n', mode: 0o100644, label: 'b.js' },
  ], join(root, 'backup'), { failBeforeCommit: 1 }), /injected transaction failure/)
  assert.equal(readFileSync(a, 'utf8'), 'old-a\n')
  assert.equal(readFileSync(b, 'utf8'), 'old-b\n')
})

test('records and restores a successful multi-file transaction', () => {
  const { root, a, b } = setup()
  const backup = join(root, 'backup')
  commitFiles([
    { path: a, content: 'new-a\n', mode: 0o100644, label: 'a.js' },
    { path: b, content: 'new-b\n', mode: 0o100644, label: 'b.js' },
  ], backup)
  assert.equal(readFileSync(a, 'utf8'), 'new-a\n')
  assert.equal(readFileSync(b, 'utf8'), 'new-b\n')
  assert.deepEqual(restoreBackupDir(backup), [a, b])
  assert.equal(readFileSync(a, 'utf8'), 'old-a\n')
  assert.equal(readFileSync(b, 'utf8'), 'old-b\n')
})
