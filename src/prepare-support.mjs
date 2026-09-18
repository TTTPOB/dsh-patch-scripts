import { spawnSync } from 'node:child_process'

export function supportArguments(deployment) {
  const support = deployment.packages.filter(pkg => pkg.support)
  return [
    'pnpm@11.24.0',
    '--dir', deployment.installation.projectRoot,
    'add', '--save-exact',
    ...support.map(pkg => `${pkg.name}@${pkg.version}`),
  ]
}

export function prepareSupport(deployment, options = {}) {
  if (deployment.installation === undefined) throw new Error('deployment has no writable installation project')
  const args = supportArguments(deployment)
  const result = (options.spawnSync ?? spawnSync)('corepack', args, { stdio: 'inherit' })
  if (result.status !== 0) throw new Error(`support dependency installation failed with status ${String(result.status)}`)
  return { command: ['corepack', ...args], projectRoot: deployment.installation.projectRoot }
}
