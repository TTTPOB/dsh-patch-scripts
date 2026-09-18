import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  DSH_VERSION,
  installationTargets,
  supportDependencies,
  verificationSharedDependencies,
} from './package-set.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const baseline = resolve(here, '../baselines/dsh-0.1.5-rc.2')
const root = { path: baseline, importer: 'baselines/dsh-0.1.5-rc.2' }

export default {
  id: 'official-0.1.5-rc.2',
  description: 'Unmodified official package baseline for DSH 0.1.5-rc.2',
  dshVersion: DSH_VERSION,
  checkCli: false,
  officialOnly: true,
  roots: { baseline: root },
  packages: [
    ...verificationSharedDependencies.map(([name, version]) => ({
      root: 'baseline', name, version, direct: false, checkManifest: true,
    })),
    ...installationTargets.map(([name, version]) => ({
      root: 'baseline', name, version, direct: false, checkManifest: true,
      installationTarget: true,
    })),
    ...supportDependencies.map(([name, version]) => ({
      root: 'baseline', name, version, direct: false, checkManifest: true,
      support: true,
    })),
  ],
  patchDependencies: [
    { from: '@deepseek-ai/dsh-llm-pi-ai', packageName: '@earendil-works/pi-ai' },
    { from: '@deepseek-ai/dsh-mcp-client', packageName: '@modelcontextprotocol/client' },
    { from: '@deepseek-ai/dsh-mcp-client', specifier: '@modelcontextprotocol/client/stdio' },
    { from: '@deepseek-ai/dsh-mcp-client', packageName: '@modelcontextprotocol/core' },
  ],
  patches: [
    'subagent-settlement',
    'pi-final-tool-arguments',
    'openai-responses-instructions',
    'llm-pi-ai-deferred-tools',
    'mcp-client-v2',
  ],
}
