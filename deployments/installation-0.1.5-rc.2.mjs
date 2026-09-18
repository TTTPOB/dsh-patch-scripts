import { homedir } from 'node:os'
import { resolve } from 'node:path'
import { resolveDshInstallation } from '../src/package-resolver.mjs'
import {
  DSH_VERSION,
  installationTargets,
  supportDependencies,
  verificationSharedDependencies,
} from './package-set.mjs'

const installation = resolveDshInstallation()
const dshHome = resolve(process.env.DSH_HOME || resolve(homedir(), '.dsh'))
const root = {
  path: installation.dsh.realPath,
  manifestPath: installation.projectRoot,
  lockPath: installation.projectRoot,
  importer: '.',
}

export default {
  id: 'installation-0.1.5-rc.2',
  description: 'Installation-wide patches for the active official DSH installation',
  dshVersion: DSH_VERSION,
  checkCli: true,
  officialOnly: true,
  installation,
  roots: { installation: root },
  packages: [
    ...verificationSharedDependencies.map(([name, version]) => ({
      root: 'installation', name, version, direct: false, checkManifest: false,
    })),
    ...installationTargets.map(([name, version]) => ({
      root: 'installation', name, version, direct: false, checkManifest: false,
      installationTarget: true,
    })),
    ...supportDependencies.map(([name, version]) => ({
      root: 'installation', name, version, direct: false, checkManifest: true,
      support: true,
    })),
  ],
  patchDependencies: [
    { from: '@deepseek-ai/dsh-llm-pi-ai', packageName: '@earendil-works/pi-ai' },
    { from: '@deepseek-ai/dsh-mcp-client', packageName: '@modelcontextprotocol/client' },
    { from: '@deepseek-ai/dsh-mcp-client', specifier: '@modelcontextprotocol/client/stdio' },
    { from: '@deepseek-ai/dsh-mcp-client', packageName: '@modelcontextprotocol/core' },
  ],
  shadowProfiles: [{
    name: 'web',
    path: resolve(dshHome, 'profiles/web'),
    packages: [
      '@deepseek-ai/dsh-llm-pi-ai',
      '@deepseek-ai/dsh-mcp-client',
      '@earendil-works/pi-ai',
      '@modelcontextprotocol/client',
      '@modelcontextprotocol/core',
    ],
  }],
  patches: [
    'subagent-settlement',
    'pi-final-tool-arguments',
    'openai-responses-instructions',
    'llm-pi-ai-deferred-tools',
    'mcp-client-v2',
  ],
}
