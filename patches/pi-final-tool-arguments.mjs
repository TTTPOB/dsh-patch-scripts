export default {
  id: 'pi-final-tool-arguments',
  description: 'Parse streamed tool arguments only when each tool call finishes',
  targets: [
    {
      packageName: '@earendil-works/pi-ai',
      files: [
        {
          path: 'dist/types.d.ts',
          edits: [{
            before: '    samplingParams?: Record<string, unknown>;\n    maxTokens?: number;\n    /**\n     * Preferred transport for providers that support multiple transports.\n',
            after: '    samplingParams?: Record<string, unknown>;\n    maxTokens?: number;\n    /**\n     * Controls when streamed tool-call arguments are parsed.\n     * `"partial"` (default) provides best-effort parsed arguments on each delta;\n     * `"final"` only promises parsed arguments when the tool call terminates.\n     * Raw argument deltas are unchanged in either mode.\n     */\n    toolCallParsing?: "partial" | "final";\n    /**\n     * Preferred transport for providers that support multiple transports.\n',
          }],
        },
        {
          path: 'dist/api/anthropic-messages.js',
          edits: [{
            before: '                            block.partialJson += event.delta.partial_json;\n                            block.arguments = parseStreamingJson(block.partialJson);\n',
            after: '                            block.partialJson += event.delta.partial_json;\n                            if (options?.toolCallParsing !== "final") {\n                                block.arguments = parseStreamingJson(block.partialJson);\n                            }\n',
          }],
        },
        {
          path: 'dist/api/azure-openai-responses.js',
          edits: [{
            before: '            await processResponsesStream(openaiStream, output, stream, model, { grammarToolInputProperties });\n',
            after: '            await processResponsesStream(openaiStream, output, stream, model, {\n                toolCallParsing: options?.toolCallParsing,\n                grammarToolInputProperties,\n            });\n',
          }],
        },
        {
          path: 'dist/api/bedrock-converse-stream.js',
          edits: [
            {
              before: '                    handleContentBlockDelta(item.contentBlockDelta, blocks, output, stream);\n',
              after: '                    handleContentBlockDelta(item.contentBlockDelta, blocks, output, stream, options.toolCallParsing);\n',
            },
            {
              before: 'function handleContentBlockDelta(event, blocks, output, stream) {\n',
              after: 'function handleContentBlockDelta(event, blocks, output, stream, toolCallParsing) {\n',
            },
            {
              before: '        block.partialJson = (block.partialJson || "") + (delta.toolUse.input || "");\n        block.arguments = parseStreamingJson(block.partialJson);\n',
              after: '        block.partialJson = (block.partialJson || "") + (delta.toolUse.input || "");\n        if (toolCallParsing !== "final") {\n            block.arguments = parseStreamingJson(block.partialJson);\n        }\n',
            },
          ],
        },
        {
          path: 'dist/api/mistral-conversations.js',
          edits: [
            {
              before: '            await consumeChatStream(model, output, stream, mistralStream);\n',
              after: '            await consumeChatStream(model, output, stream, mistralStream, options?.toolCallParsing);\n',
            },
            {
              before: 'async function consumeChatStream(model, output, stream, mistralStream) {\n',
              after: 'async function consumeChatStream(model, output, stream, mistralStream, toolCallParsing) {\n',
            },
            {
              before: '            block.partialArgs = (block.partialArgs || "") + argsDelta;\n            block.arguments = parseStreamingJson(block.partialArgs);\n',
              after: '            block.partialArgs = (block.partialArgs || "") + argsDelta;\n            if (toolCallParsing !== "final") {\n                block.arguments = parseStreamingJson(block.partialArgs);\n            }\n',
            },
          ],
        },
        {
          path: 'dist/api/openai-codex-responses.js',
          edits: [
            {
              before: '    await processResponsesStream(mapCodexEvents(parseSSE(response, options?.signal), output), output, stream, model, {\n        serviceTier: options?.serviceTier,\n',
              after: '    await processResponsesStream(mapCodexEvents(parseSSE(response, options?.signal), output), output, stream, model, {\n        toolCallParsing: options?.toolCallParsing,\n        serviceTier: options?.serviceTier,\n',
            },
            {
              before: '        await processResponsesStream(startWebSocketOutputOnFirstEvent(mapCodexEvents(parseWebSocket(socket, options?.signal, idleTimeoutMs), output), onStart), output, stream, model, {\n            serviceTier: options?.serviceTier,\n',
              after: '        await processResponsesStream(startWebSocketOutputOnFirstEvent(mapCodexEvents(parseWebSocket(socket, options?.signal, idleTimeoutMs), output), onStart), output, stream, model, {\n            toolCallParsing: options?.toolCallParsing,\n            serviceTier: options?.serviceTier,\n',
            },
          ],
        },
        {
          path: 'dist/api/openai-completions.js',
          edits: [{
            before: '                                block.partialArgs = (block.partialArgs ?? "") + toolCall.function.arguments;\n                                block.arguments = parseStreamingJson(block.partialArgs);\n',
            after: '                                block.partialArgs = (block.partialArgs ?? "") + toolCall.function.arguments;\n                                if (options?.toolCallParsing !== "final") {\n                                    block.arguments = parseStreamingJson(block.partialArgs);\n                                }\n',
          }],
        },
        {
          path: 'dist/api/openai-responses-shared.js',
          edits: [
            {
              before: '            slot.block.partialJson += event.delta;\n            slot.block.arguments = parseStreamingJson(slot.block.partialJson);\n',
              after: '            slot.block.partialJson += event.delta;\n            if (options?.toolCallParsing !== "final") {\n                slot.block.arguments = parseStreamingJson(slot.block.partialJson);\n            }\n',
            },
            {
              before: '            slot.block.partialJson = event.arguments;\n            slot.block.arguments = parseStreamingJson(slot.block.partialJson);\n',
              after: '            slot.block.partialJson = event.arguments;\n            if (options?.toolCallParsing !== "final") {\n                slot.block.arguments = parseStreamingJson(slot.block.partialJson);\n            }\n',
            },
            {
              before: '                slot.block.arguments = parseStreamingJson(item.arguments || slot.block.partialJson || "{}");\n',
              after: '                slot.block.partialJson = item.arguments || slot.block.partialJson || "";\n                slot.block.arguments = parseStreamingJson(slot.block.partialJson);\n',
            },
          ],
        },
        {
          path: 'dist/api/openai-responses.js',
          edits: [{
            before: '            await processResponsesStream(openaiStream, output, stream, model, {\n                serviceTier: options?.serviceTier,\n',
            after: '            await processResponsesStream(openaiStream, output, stream, model, {\n                toolCallParsing: options?.toolCallParsing,\n                serviceTier: options?.serviceTier,\n',
          }],
        },
        {
          path: 'dist/api/pi-messages.js',
          edits: [
            {
              before: 'function createEventConverter(model) {\n',
              after: 'function createEventConverter(model, toolCallParsing) {\n',
            },
            {
              before: '                toolJson.set(event.contentIndex, "");\n                break;\n            case "toolcall_delta": {\n                const json = `${toolJson.get(event.contentIndex) ?? ""}${event.delta}`;\n',
              after: '                if (toolCallParsing !== "final")\n                    toolJson.set(event.contentIndex, "");\n                break;\n            case "toolcall_delta": {\n                if (toolCallParsing === "final") {\n                    const content = [...partial.content];\n                    content[event.contentIndex] = { ...content[event.contentIndex] };\n                    // Preserve empty delta arguments if the producer reaches toolcall_end before the consumer drains the queue.\n                    return { ...event, partial: { ...partial, content } };\n                }\n                const json = `${toolJson.get(event.contentIndex) ?? ""}${event.delta}`;\n',
            },
            {
              before: '            case "toolcall_end":\n                Object.assign(partial.content[event.contentIndex], event.toolCall);\n',
              after: '            case "toolcall_end": {\n                Object.assign(partial.content[event.contentIndex], event.toolCall);\n',
            },
            {
              before: '                    partial,\n                };\n        }\n',
              after: '                    partial,\n                };\n            }\n        }\n',
            },
            {
              before: '    const convertEvent = createEventConverter(model);\n',
              after: '    const convertEvent = createEventConverter(model, options?.toolCallParsing);\n',
            },
          ],
        },
        {
          path: 'dist/api/simple-options.js',
          edits: [{
            before: '        fetch: options?.fetch,\n        transport: options?.transport,\n',
            after: '        fetch: options?.fetch,\n        toolCallParsing: options?.toolCallParsing,\n        transport: options?.transport,\n',
          }],
        },
      ],
    },
    {
      packageName: '@deepseek-ai/dsh-llm-pi-ai',
      files: [{
        path: 'lib/index.js',
        edits: [{
          before: '\t\t\t\t\tsignal: watchdog.signal,\n\t\t\t\t\theaders: requestHeaders(profile.headers)\n',
          after: '\t\t\t\t\ttoolCallParsing: "final",\n\t\t\t\t\tsignal: watchdog.signal,\n\t\t\t\t\theaders: requestHeaders(profile.headers)\n',
        }],
      }],
    },
  ],
}
