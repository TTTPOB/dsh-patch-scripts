import { existsSync, readFileSync, realpathSync } from 'node:fs'
import { dirname, join, parse, resolve } from 'node:path'
import { createRequire } from 'node:module'

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
  let result
  if (manifestPath !== undefined) {
    const value = readJson(manifestPath)
    result = { path: dirname(manifestPath), manifest: manifestPath, value }
  } else {
    result = findPackageRoot(require.resolve(name), name)
  }
  const directPath = packagePath(root, name)
  const direct = existsSync(directPath) && realpathSync(directPath) === realpathSync(result.path)
  return {
    ...result,
    path: resolve(result.path),
    realPath: realpathSync(result.path),
    directPath,
    direct,
    require: createRequire(result.manifest),
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
