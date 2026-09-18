export default {
  id: 'llm-pi-ai-deferred-tools',
  description: 'Expose pi-ai deferred tool compatibility settings',
  targets: [{
    packageName: '@deepseek-ai/dsh-llm-pi-ai',
    files: [{
      path: 'lib/index.js',
      edits: [
        {
          before: 'const THINKING_TOKEN_BUDGET_FIELDS = Object.keys({\n\tthinking_token_budget: true,\n\tthinking_budget: true,\n\tthinking_budget_tokens: true\n});\n',
          after: 'const THINKING_TOKEN_BUDGET_FIELDS = Object.keys({\n\tthinking_token_budget: true,\n\tthinking_budget: true,\n\tthinking_budget_tokens: true\n});\nconst DEFERRED_TOOLS_MODES = Object.keys({ kimi: true });\n',
        },
        {
          before: '\tdeferredToolsMode: "withhold",\n',
          after: '\tdeferredToolsMode: "offer",\n',
        },
        {
          before: '\tsupportsAdditionalTools: "withhold",\n\tsupportsToolSearch: "withhold",\n',
          after: '\tsupportsAdditionalTools: "offer",\n\tsupportsToolSearch: "offer",\n',
        },
        {
          before: '\t\tsupportsToolReferences: "withhold",\n',
          after: '\t\tsupportsToolReferences: "offer",\n',
        },
        {
          before: '\tallowEmptySignature: z.boolean(),\n\tsupportsStrictTools: z.boolean()\n});\n',
          after: '\tallowEmptySignature: z.boolean(),\n\tsupportsStrictTools: z.boolean(),\n\tdeferredToolsMode: z.union(DEFERRED_TOOLS_MODES),\n\tsupportsToolSearch: z.boolean(),\n\tsupportsAdditionalTools: z.boolean(),\n\tsupportsToolReferences: z.boolean()\n});\n',
        },
      ],
    }],
  }],
}
