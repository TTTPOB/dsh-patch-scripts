import { existsSync, readFileSync, realpathSync } from 'node:fs'
import { dirname, join, parse, resolve } from 'node:path'
import { createRequire } from 'node:module'
import { spawnSync } from 'node:child_process'

export function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

function packagePath(root, name) {
  return join(root, 'node_modules', ...name.split('/'))
}

function findPackageRoot(entry, expectedName) {
  let current = dirname(entry)
  const filesystemRoot = parse(current).root
  while (current !== filesystemRoot) {
    const manifest = join(current, 'package.json')
    if (existsSync(manifest)) {
      const value = readJson(manifest)
      if (value.name === expectedName) return { path: current, manifest, value }
    }
    current = dirname(current)
  }
  throw new Error(`cannot locate package.json for ${expectedName} from ${entry}`)
}

function findInstalledManifest(root, name) {
  let current = resolve(root)
  while (true) {
    const candidate = join(packagePath(current, name), 'package.json')
    if (existsSync(candidate)) return candidate
    const parent = dirname(current)
    if (parent === current) return undefined
    current = parent
  }
}

function resolvedPackage(manifestPath, directPath) {
  const value = readJson(manifestPath)
  const path = dirname(manifestPath)
  return {
    path: resolve(path),
    manifest: manifestPath,
    value,
    realPath: realpathSync(path),
    directPath,
    direct: directPath !== undefined
      && existsSync(directPath)
      && realpathSync(directPath) === realpathSync(path),
    require: createRequire(manifestPath),
  }
}

export function resolvePackage(root, name) {
  const anchor = join(root, 'package.json')
  const require = createRequire(anchor)
  let manifestPath = findInstalledManifest(root, name)
  if (manifestPath === undefined) {
    try {
      manifestPath = require.resolve(`${name}/package.json`)
    } catch {
      manifestPath = undefined
    }
  }
  if (manifestPath !== undefined) return resolvedPackage(manifestPath, packagePath(root, name))
  const result = findPackageRoot(require.resolve(name), name)
  return resolvedPackage(result.manifest, packagePath(root, name))
}

export function resolveDependencyPackage(owner, name) {
  const manifestPath = findInstalledManifest(owner.path, name)
  if (manifestPath !== undefined) return resolvedPackage(manifestPath)
  try {
    return resolvedPackage(owner.require.resolve(`${name}/package.json`))
  } catch {
    return resolvedPackage(findPackageRoot(owner.require.resolve(name), name).manifest)
  }
}

export function resolveFromPackage(pkg, specifier) {
  try {
    return pkg.require.resolve(specifier)
  } catch (error) {
    const code = error && typeof error === 'object' && 'code' in error ? error.code : 'UNKNOWN'
    throw new Error(`${pkg.value.name} cannot resolve ${specifier} (${code})`)
  }
}

function commandPath(command) {
  if (command.includes('/')) return resolve(command)
  const result = spawnSync('sh', ['-c', 'command -v -- "$1"', 'sh', command], { encoding: 'utf8' })
  if (result.status !== 0) throw new Error(`dsh executable not found: ${command}`)
  return resolve(result.stdout.trim())
}

function shimTarget(executable) {
  const text = readFileSync(executable, 'utf8')
  const marker = text.match(/^# cmd-shim-target=(.+)$/m)?.[1]
  if (marker !== undefined) return resolve(dirname(executable), marker)
  if (text.startsWith('#!') && text.includes('node')) return executable
  throw new Error(`cannot determine DSH entry from executable: ${executable}`)
}

function installationProjectFromEntry(entry, dshPackagePath) {
  let current = dirname(entry)
  while (true) {
    const candidate = packagePath(current, '@deepseek-ai/dsh')
    if (existsSync(candidate) && realpathSync(candidate) === realpathSync(dshPackagePath)) return current
    const parent = dirname(current)
    if (parent === current) break
    current = parent
  }
  throw new Error(`cannot locate installation project from DSH entry: ${entry}`)
}

export function resolveDshInstallation(options = {}) {
  const override = options.root ?? process.env.DSH_PATCH_INSTALLATION_ROOT
  if (override !== undefined && override !== '') {
    const projectRoot = resolve(override)
    const dsh = resolvePackage(projectRoot, '@deepseek-ai/dsh')
    return { projectRoot, dsh, executable: options.dshBin ?? process.env.DSH_BIN ?? 'dsh' }
  }

  const executable = commandPath(options.dshBin ?? process.env.DSH_BIN ?? 'dsh')
  const entry = shimTarget(executable)
  const dshRoot = findPackageRoot(entry, '@deepseek-ai/dsh').path
  const projectRoot = installationProjectFromEntry(entry, dshRoot)
  return {
    projectRoot,
    dsh: resolvedPackage(join(dshRoot, 'package.json'), packagePath(projectRoot, '@deepseek-ai/dsh')),
    executable,
  }
}
