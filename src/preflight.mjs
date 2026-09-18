import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import YAML from 'yaml'
import { readJson, resolveFromPackage, resolvePackage } from './package-resolver.mjs'

const FORBIDDEN_SPEC = /^(?:file:|link:|git(?:\+|:)|github:|https?:)/

function findUp(start, name) {
  let current = resolve(start)
  while (true) {
    const candidate = join(current, name)
    if (existsSync(candidate)) return candidate
    const parent = dirname(current)
    if (parent === current) return undefined
    current = parent
  }
}

function lockSpecifier(lock, importer, name) {
  const record = lock.importers?.[importer]?.dependencies?.[name]
    ?? lock.importers?.[importer]?.devDependencies?.[name]
  if (typeof record === 'string') return record
  return record?.specifier
}

function packageLockKeyIsOfficial(lock, name, version) {
  const keys = Object.keys(lock.packages ?? {})
  return keys.some(key => key === `${name}@${version}` || key.startsWith(`${name}@${version}(`))
}

function inspectCli(expected) {
  const command = process.env.DSH_BIN || 'dsh'
  const which = spawnSync('sh', ['-c', `command -v "${command}"`], { encoding: 'utf8' })
  if (which.status !== 0) throw new Error(`dsh executable not found: ${command}`)
  const version = spawnSync(command, ['--version'], { encoding: 'utf8' })
  if (version.status !== 0) throw new Error(`failed to execute ${command} --version`)
  const actual = version.stdout.trim()
  if (actual !== expected) throw new Error(`dsh version mismatch: expected ${expected}, got ${actual}`)
  return { path: which.stdout.trim(), version: actual }
}

export function preflightDeployment(deployment, options = {}) {
  const errors = []
  const packages = new Map()
  let cli
  if (deployment.checkCli && !options.skipCli) {
    try {
      cli = inspectCli(deployment.dshVersion)
    } catch (error) {
      errors.push(error.message)
    }
  }

  const lockCache = new Map()
  for (const expected of deployment.packages) {
    const root = deployment.roots[expected.root]
    if (root === undefined) {
      errors.push(`${expected.name}: unknown root ${expected.root}`)
      continue
    }
    try {
      const pkg = resolvePackage(root.path, expected.name)
      packages.set(expected.name, { expected, root, pkg })
      if (pkg.value.name !== expected.name) errors.push(`${expected.name}: resolved manifest names ${pkg.value.name}`)
      if (pkg.value.version !== expected.version) {
        errors.push(`${expected.name}: expected ${expected.version}, got ${pkg.value.version}`)
      }
      if (expected.direct && !pkg.direct) {
        errors.push(`${expected.name}: expected a direct package under ${root.path}, resolved ${pkg.realPath}`)
      }
      const checkManifest = expected.checkManifest ?? expected.direct
      if (checkManifest) {
        const manifest = readJson(join(root.path, 'package.json'))
        const spec = manifest.dependencies?.[expected.name] ?? manifest.devDependencies?.[expected.name]
        if (spec !== expected.version) {
          errors.push(`${expected.name}: root manifest must pin ${expected.version}, got ${String(spec)}`)
        }
        if (deployment.officialOnly && typeof spec === 'string' && FORBIDDEN_SPEC.test(spec)) {
          errors.push(`${expected.name}: non-registry specifier ${spec}`)
        }
      }
      if (root.importer !== null) {
        const lockPath = findUp(root.path, 'pnpm-lock.yaml')
        if (lockPath === undefined) {
          errors.push(`${expected.name}: pnpm-lock.yaml not found from ${root.path}`)
        } else {
          let lock = lockCache.get(lockPath)
          if (lock === undefined) {
            lock = YAML.parse(readFileSync(lockPath, 'utf8'))
            lockCache.set(lockPath, lock)
          }
          const spec = lockSpecifier(lock, root.importer, expected.name)
          if (spec !== expected.version) {
            errors.push(`${expected.name}: lock importer ${root.importer} must pin ${expected.version}, got ${String(spec)}`)
          }
          if (deployment.officialOnly && typeof spec === 'string' && FORBIDDEN_SPEC.test(spec)) {
            errors.push(`${expected.name}: lockfile uses non-registry specifier ${spec}`)
          }
          if (deployment.officialOnly && !packageLockKeyIsOfficial(lock, expected.name, expected.version)) {
            errors.push(`${expected.name}: no official ${expected.version} package entry in ${lockPath}`)
          }
        }
      }
    } catch (error) {
      errors.push(`${expected.name}: ${error.message}`)
    }
  }

  for (const dependency of deployment.patchDependencies ?? []) {
    const owner = packages.get(dependency.from)
    if (owner === undefined) {
      errors.push(`${dependency.from}: dependency owner did not resolve`)
      continue
    }
    try {
      resolveFromPackage(owner.pkg, dependency.specifier)
    } catch (error) {
      errors.push(error.message)
    }
  }

  return { ok: errors.length === 0, errors, packages, cli }
}

export function assertPreflight(deployment, options) {
  const result = preflightDeployment(deployment, options)
  if (!result.ok) throw new Error(`preflight failed:\n- ${result.errors.join('\n- ')}`)
  return result
}
