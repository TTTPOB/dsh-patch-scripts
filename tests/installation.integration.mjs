import assert from 'node:assert/strict'
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import YAML from 'yaml'
import { prepareSupport } from '../src/prepare-support.mjs'

const repositoryRoot = dirname(dirname(fileURLToPath(import.meta.url)))
const fixtureRoot = join(repositoryRoot, '.patch-work', 'support-installation-fixture')
const installationRoot = join(fixtureRoot, 'installation')
const parentLockPath = join(fixtureRoot, 'pnpm-lock.yaml')
const parentLock = "lockfileVersion: '9.0'\n\nimporters:\n\n  .: {}\n"

rmSync(fixtureRoot, { recursive: true, force: true })
mkdirSync(installationRoot, { recursive: true })
writeFileSync(join(fixtureRoot, 'pnpm-workspace.yaml'), "packages:\n  - installation\n")
writeFileSync(parentLockPath, parentLock)
writeFileSync(join(fixtureRoot, 'package.json'), '{"name":"parent-workspace","private":true}\n')
writeFileSync(join(installationRoot, 'package.json'), '{"name":"installation","private":true}\n')

const deployment = {
  installation: { projectRoot: installationRoot },
  packages: [
    { name: '@modelcontextprotocol/client', version: '2.0.0', support: true },
    { name: '@modelcontextprotocol/core', version: '2.0.0', support: true },
  ],
}

prepareSupport(deployment)

const manifest = JSON.parse(readFileSync(join(installationRoot, 'package.json'), 'utf8'))
assert.equal(manifest.dependencies['@modelcontextprotocol/client'], '2.0.0')
assert.equal(manifest.dependencies['@modelcontextprotocol/core'], '2.0.0')

const lock = YAML.parse(readFileSync(join(installationRoot, 'pnpm-lock.yaml'), 'utf8'))
assert.equal(lock.importers['.'].dependencies['@modelcontextprotocol/client'].specifier, '2.0.0')
assert.equal(lock.importers['.'].dependencies['@modelcontextprotocol/client'].version, '2.0.0')
assert.equal(lock.importers['.'].dependencies['@modelcontextprotocol/core'].specifier, '2.0.0')
assert.equal(lock.importers['.'].dependencies['@modelcontextprotocol/core'].version, '2.0.0')
assert.equal(existsSync(join(installationRoot, 'node_modules', '.pnpm')), true)

assert.equal(readFileSync(parentLockPath, 'utf8'), parentLock)
assert.equal(existsSync(join(fixtureRoot, 'node_modules')), false)
for (const root of [fixtureRoot, installationRoot]) {
  assert.equal(existsSync(join(root, '.pnpm-store')), false)
  assert.equal(existsSync(join(root, '.pnpm-cache')), false)
}

console.log(`support installation integration fixture passed: ${fixtureRoot}`)
