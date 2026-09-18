export default {
  id: 'openai-responses-instructions',
  description: 'Allow OpenAI Responses system prompts through instructions',
  targets: [
    {
      packageName: '@earendil-works/pi-ai',
      files: [{
        path: 'dist/api/openai-responses.js',
        edits: [
          {
            before: 'import { retryProviderRequest } from "../utils/provider-retry.js";\n',
            after: 'import { retryProviderRequest } from "../utils/provider-retry.js";\nimport { sanitizeSurrogates } from "../utils/sanitize-unicode.js";\n',
          },
          {
            before: '        supportsDeveloperRole: model.compat?.supportsDeveloperRole ?? true,\n',
            after: '        supportsDeveloperRole: model.compat?.supportsDeveloperRole ?? true,\n        systemPromptFormat: model.compat?.systemPromptFormat ?? "input",\n',
          },
          {
            before: '    const messages = convertResponsesMessages(model, context, OPENAI_TOOL_CALL_PROVIDERS, {\n        grammarToolInputProperties,\n',
            after: '    const messages = convertResponsesMessages(model, context, OPENAI_TOOL_CALL_PROVIDERS, {\n        includeSystemPrompt: compat.systemPromptFormat === "input",\n        grammarToolInputProperties,\n',
          },
          {
            before: '        store: false,\n    };\n    if (options?.maxTokens && compat.supportsMaxOutputTokens) {\n',
            after: '        store: false,\n    };\n    if (compat.systemPromptFormat === "instructions" && context.systemPrompt) {\n        params.instructions = sanitizeSurrogates(context.systemPrompt);\n    }\n    if (options?.maxTokens && compat.supportsMaxOutputTokens) {\n',
          },
        ],
      }],
    },
    {
      packageName: '@deepseek-ai/dsh-llm-pi-ai',
      files: [{
        path: 'lib/index.js',
        edits: [
          {
            before: 'const RESPONSES_COMPAT_GATE = {\n\tsupportsDeveloperRole: "offer",\n',
            after: 'const RESPONSES_COMPAT_GATE = {\n\tsupportsDeveloperRole: "offer",\n\tsystemPromptFormat: "offer",\n',
          },
          {
            before: 'const compatProfile = z.object({\n\tsupportsStore: z.boolean(),\n\tsupportsDeveloperRole: z.boolean(),\n',
            after: 'const compatProfile = z.object({\n\tsupportsStore: z.boolean(),\n\tsupportsDeveloperRole: z.boolean(),\n\tsystemPromptFormat: z.union(["input", "instructions"]),\n',
          },
        ],
      }],
    },
  ],
}
