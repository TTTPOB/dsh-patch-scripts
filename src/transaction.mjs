import { copyFileSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

export function commitFiles(changes, backupDir, options = {}) {
  mkdirSync(backupDir, { recursive: true })
  const staged = []
  const committed = []
  try {
    for (const [index, change] of changes.entries()) {
      const backup = join(backupDir, `${index}-${change.label}`)
      mkdirSync(dirname(backup), { recursive: true })
      copyFileSync(change.path, backup)
      const temporary = `${change.path}.dsh-patch-${process.pid}-${index}`
      writeFileSync(temporary, change.content, { mode: change.mode })
      staged.push({ ...change, backup, temporary })
    }
    for (const [index, change] of staged.entries()) {
      if (options.failBeforeCommit === index) throw new Error(`injected transaction failure at ${index}`)
      renameSync(change.temporary, change.path)
      committed.push(change)
    }
    const manifest = committed.map(change => ({ path: change.path, backup: change.backup }))
    writeFileSync(join(backupDir, 'backup.json'), `${JSON.stringify({ files: manifest }, null, 2)}\n`)
    return { backupDir, files: committed.map(change => change.path) }
  } catch (error) {
    for (const change of committed.reverse()) copyFileSync(change.backup, change.path)
    for (const change of staged) rmSync(change.temporary, { force: true })
    throw error
  }
}

export function restoreBackup(changes) {
  for (const change of changes) copyFileSync(change.backup, change.path)
}

export function restoreBackupDir(backupDir) {
  const manifest = JSON.parse(readFileSync(join(backupDir, 'backup.json'), 'utf8'))
  restoreBackup(manifest.files)
  return manifest.files.map(file => file.path)
}
