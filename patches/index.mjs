import subagentSettlement from './subagent-settlement.mjs'
import openaiResponsesInstructions from './openai-responses-instructions.mjs'
import piFinalToolArguments from './pi-final-tool-arguments.mjs'
import llmPiAiDeferredTools from './llm-pi-ai-deferred-tools.mjs'
import mcpClientV2 from './mcp-client-v2.mjs'

const patches = [
  subagentSettlement,
  piFinalToolArguments,
  openaiResponsesInstructions,
  llmPiAiDeferredTools,
  mcpClientV2,
]

export const patchRegistry = new Map(patches.map(patch => [patch.id, patch]))

if (patchRegistry.size !== patches.length) throw new Error('duplicate patch id')

export function selectPatches(ids) {
  return ids.map(id => {
    const patch = patchRegistry.get(id)
    if (patch === undefined) throw new Error(`unknown patch: ${id}`)
    return patch
  })
}
