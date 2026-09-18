import { resolve } from 'node:path'
import { homedir } from 'node:os'
import { DSH_VERSION, profilePackages, sharedPackages } from './package-set.mjs'

const dshHome = resolve(process.env.DSH_HOME || resolve(homedir(), '.dsh'))

export default {
  id: 'personal-web-0.1.5-rc.2',
  description: 'Personal web profile using exact official packages',
  dshVersion: DSH_VERSION,
  checkCli: true,
  officialOnly: true,
  roots: {
    profile: { path: resolve(dshHome, 'profiles/web'), importer: '.' },
    shared: { path: resolve(dshHome, 'profiles'), importer: null },
  },
  packages: [
    ...sharedPackages.map(([name, version]) => ({
      root: 'shared', name, version, direct: true, checkManifest: false,
    })),
    ...profilePackages.map(([name, version]) => ({
      root: 'profile', name, version, direct: true,
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
