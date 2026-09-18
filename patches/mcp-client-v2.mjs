export default {
  id: 'mcp-client-v2',
  description: 'Use MCP SDK v2 with modern negotiation and legacy fallback',
  targets: [{
    packageName: '@deepseek-ai/dsh-mcp-client',
    files: [
      {
        path: 'lib/index.js',
        edits: [
          {
            before: 'import { Client } from "@modelcontextprotocol/sdk/client/index.js";\nimport { ListToolsResultSchema, ToolListChangedNotificationSchema } from "@modelcontextprotocol/sdk/types.js";\nimport { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";\nimport { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";\n',
            after: 'import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";\nimport { StdioClientTransport } from "@modelcontextprotocol/client/stdio";\n',
          },
          {
            before: 'import { isDeepStrictEqual } from "node:util";\nimport { z as z$1 } from "zod";\n',
            after: 'import { isDeepStrictEqual } from "node:util";\nimport { ListToolsResultSchema } from "@modelcontextprotocol/core";\nimport { z as z$1 } from "zod";\n',
          },
          {
            before: '\tasync function connectGeneration(startup) {\n\t\tconst generation = new Client({\n\t\t\tname: "dsh-mcp-client",\n\t\t\tversion: "0.0.1"\n\t\t}, { capabilities: {} });\n\t\tconst closed = Promise.withResolvers();\n\t\tlet attemptSettled = false;\n\t\tlet closeObserved = false;\n\t\tconst hasClosed = () => closeObserved;\n',
            after: '\tasync function connectGeneration(startup) {\n\t\tlet closeObserved = false;\n\t\tconst hasClosed = () => closeObserved;\n\t\tconst generation = new Client({\n\t\t\tname: "dsh-mcp-client",\n\t\t\tversion: "0.0.1"\n\t\t}, {\n\t\t\tcapabilities: {},\n\t\t\tversionNegotiation: { mode: "auto" },\n\t\t\tlistChanged: { tools: {\n\t\t\t\tautoRefresh: false,\n\t\t\t\tonChanged: (error) => {\n\t\t\t\t\tif (!isCurrent(generation)) return;\n\t\t\t\t\tif (error !== null) {\n\t\t\t\t\t\tctx.logger.error(`${label}: tool list change notification failed: ${String(error)}`);\n\t\t\t\t\t\treturn;\n\t\t\t\t\t}\n\t\t\t\t\tctx.logger.info(`${label}: tool list changed, re-syncing`);\n\t\t\t\t\tenqueueSync(generation).catch((syncError) => {\n\t\t\t\t\t\tif (!disposed) ctx.logger.error(`${label}: tool re-sync failed: ${String(syncError)}`);\n\t\t\t\t\t});\n\t\t\t\t}\n\t\t\t} }\n\t\t});\n\t\tconst closed = Promise.withResolvers();\n\t\tlet attemptSettled = false;\n',
          },
          {
            before: '\t\tgeneration.setNotificationHandler(ToolListChangedNotificationSchema, async () => {\n\t\t\tif (!isCurrent(generation)) return;\n\t\t\tctx.logger.info(`${label}: tool list changed, re-syncing`);\n\t\t\ttry {\n\t\t\t\tawait enqueueSync(generation);\n\t\t\t} catch (error) {\n\t\t\t\tif (!disposed) ctx.logger.error(`${label}: tool re-sync failed: ${String(error)}`);\n\t\t\t}\n\t\t});\n',
            after: '',
            appliedMarker: '\t\t\tversionNegotiation: { mode: "auto" },\n',
            allowMarkerWhileReady: true,
          },
        ],
      },
      {
        path: 'lib/types/tools.d.ts',
        edits: [{
          before: "import type { Client } from '@modelcontextprotocol/sdk/client/index.js';\n",
          after: "import type { Client } from '@modelcontextprotocol/client';\n",
        }],
      },
      {
        path: 'lib/types/transport.d.ts',
        edits: [{
          before: "import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';\n",
          after: "import { type Transport } from '@modelcontextprotocol/client';\n",
        }],
      },
    ],
  }],
}
