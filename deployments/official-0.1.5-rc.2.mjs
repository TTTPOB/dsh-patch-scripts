import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DSH_VERSION, profilePackages, sharedPackages } from './package-set.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const baseline = resolve(here, '../baselines/dsh-0.1.5-rc.2')

export default {
  id: 'official-0.1.5-rc.2',
  description: 'Unmodified official package baseline for DSH 0.1.5-rc.2',
  dshVersion: DSH_VERSION,
  checkCli: false,
  officialOnly: true,
  roots: {
    profile: { path: baseline, importer: 'baselines/dsh-0.1.5-rc.2' },
    shared: { path: baseline, importer: 'baselines/dsh-0.1.5-rc.2' },
  },
  packages: [
    ...sharedPackages.map(([name, version]) => ({
      root: 'shared', name, version, direct: false, checkManifest: true,
    })),
    ...profilePackages.map(([name, version]) => ({
      root: 'profile', name, version, direct: false, checkManifest: true,
      support: name.startsWith('@modelcontextprotocol/'),
    })),
  ],
  patchDependencies: [
    { from: '@deepseek-ai/dsh-mcp-client', specifier: '@modelcontextprotocol/client' },
    { from: '@deepseek-ai/dsh-mcp-client', specifier: '@modelcontextprotocol/client/stdio' },
    { from: '@deepseek-ai/dsh-mcp-client', specifier: '@modelcontextprotocol/core' },
  ],
  patches: [
    'subagent-settlement',
    'pi-final-tool-arguments',
    'openai-responses-instructions',
    'llm-pi-ai-deferred-tools',
    'mcp-client-v2',
  ],
}
