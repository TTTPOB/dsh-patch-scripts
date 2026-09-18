import { existsSync, readFileSync, realpathSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import YAML from 'yaml'
import {
  readJson,
  resolveDependencyPackage,
  resolveFromPackage,
  resolvePackage,
} from './package-resolver.mjs'

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
  const which = spawnSync('sh', ['-c', 'command -v -- "$1"', 'sh', command], { encoding: 'utf8' })
  if (which.status !== 0) throw new Error(`dsh executable not found: ${command}`)
  const version = spawnSync(command, ['--version'], { encoding: 'utf8' })
  if (version.status !== 0) throw new Error(`failed to execute ${command} --version`)
  const actual = version.stdout.trim()
  if (actual !== expected) throw new Error(`dsh version mismatch: expected ${expected}, got ${actual}`)
  return { path: which.stdout.trim(), version: actual }
}

function profileShadowErrors(deployment, packages) {
  const errors = []
  for (const profile of deployment.shadowProfiles ?? []) {
    const manifestPath = join(profile.path, 'package.json')
    const manifest = existsSync(manifestPath) ? readJson(manifestPath) : {}
    const shadows = []
    for (const name of profile.packages) {
      const declared = manifest.dependencies?.[name] !== undefined || manifest.devDependencies?.[name] !== undefined
      const profilePath = join(profile.path, 'node_modules', ...name.split('/'))
      const expected = packages.get(name)?.pkg.realPath
      const differentCopy = existsSync(profilePath)
        && expected !== undefined
        && realpathSync(profilePath) !== expected
      if (declared || differentCopy) shadows.push(name)
    }
    if (shadows.length > 0) {
      errors.push(`${profile.name} profile shadows installation packages: ${shadows.join(', ')}; reconcile with: dsh plugin --profile ${profile.name} remove ${shadows.join(' ')}`)
    }
  }
  return errors
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
      const manifestRoot = root.manifestPath ?? root.path
      if (checkManifest) {
        const manifest = readJson(join(manifestRoot, 'package.json'))
        const spec = manifest.dependencies?.[expected.name] ?? manifest.devDependencies?.[expected.name]
        if (spec !== expected.version) {
          errors.push(`${expected.name}: root manifest must pin ${expected.version}, got ${String(spec)}`)
        }
        if (deployment.officialOnly && typeof spec === 'string' && FORBIDDEN_SPEC.test(spec)) {
          errors.push(`${expected.name}: non-registry specifier ${spec}`)
        }
      }
      if (root.importer !== null) {
        const lockPath = findUp(root.lockPath ?? manifestRoot, 'pnpm-lock.yaml')
        if (lockPath === undefined) {
          errors.push(`${expected.name}: pnpm-lock.yaml not found from ${root.lockPath ?? manifestRoot}`)
        } else {
          let lock = lockCache.get(lockPath)
          if (lock === undefined) {
            lock = YAML.parse(readFileSync(lockPath, 'utf8'))
            lockCache.set(lockPath, lock)
          }
          const spec = lockSpecifier(lock, root.importer, expected.name)
          if (checkManifest && spec !== expected.version) {
            errors.push(`${expected.name}: lock importer ${root.importer} must pin ${expected.version}, got ${String(spec)}`)
          }
          if (checkManifest && deployment.officialOnly && typeof spec === 'string' && FORBIDDEN_SPEC.test(spec)) {
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
      if (dependency.packageName !== undefined) {
        const resolved = resolveDependencyPackage(owner.pkg, dependency.packageName)
        const expected = packages.get(dependency.packageName)
        if (expected === undefined) throw new Error(`${dependency.packageName}: expected package did not resolve`)
        if (resolved.realPath !== expected.pkg.realPath) {
          throw new Error(`${dependency.from} resolves ${dependency.packageName} to ${resolved.realPath}, not patched package ${expected.pkg.realPath}`)
        }
      } else {
        resolveFromPackage(owner.pkg, dependency.specifier)
      }
    } catch (error) {
      errors.push(error.message)
    }
  }

  errors.push(...profileShadowErrors(deployment, packages))
  return { ok: errors.length === 0, errors, packages, cli }
}

export function assertPreflight(deployment, options) {
  const result = preflightDeployment(deployment, options)
  if (!result.ok) throw new Error(`preflight failed:\n- ${result.errors.join('\n- ')}`)
  return result
}
