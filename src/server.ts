#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ToolSchema,
} from "@modelcontextprotocol/sdk/types.js";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import { zodToJsonSchema } from "zod-to-json-schema";

import {
  TypescriptAnalyzeTextSchema,
  TypescriptAnalyzeFileSchema,
  TypescriptAnalyzeDirectorySchema,
  ToolName,
} from "./schemas.js";
import { handlers } from "./handlers.js";

const ToolInputSchema = ToolSchema.shape.inputSchema;
type ToolInput = typeof ToolInputSchema._type;

function convertSchema(schema: any): ToolInput {
  const converted = zodToJsonSchema(schema) as any;
  return {
    type: "object",
    properties: converted.properties || {},
    required: converted.required || [],
  } as ToolInput;
}

export async function createServer() {
  const server = new Server(
    {
      name: "mcp-qualytics",
      version: "0.1.4",
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    const tools: Tool[] = [
      {
        name: ToolName.TYPESCRIPT_ANALYZE_TEXT,
        description: `Analyzes TypeScript code quality metrics from provided text.

Key metrics include:
- Logical Lines of Code (LLOC): Counts executable code elements including:
  * Statements (if, loops, return, etc.)
  * Declarations (variables, functions, classes, etc.)
  * Expressions (calls, assignments, etc.)
  * TypeScript-specific elements (interfaces, type aliases, etc.)
- Cyclomatic complexity
- Maintainability index (0-100 scale)
- Function-level metrics
- Class metrics including inheritance depth

Output formats: text (detailed) or markdown table (concise).

Can analyze complete files or individual functions.`,
        inputSchema: convertSchema(TypescriptAnalyzeTextSchema),
      },
      {
        name: ToolName.TYPESCRIPT_ANALYZE_FILE,
        description: `Analyzes TypeScript code quality metrics for a single file.

Key metrics include:
- Logical Lines of Code (LLOC): Counts executable code elements including:
  * Statements (if, loops, return, etc.)
  * Declarations (variables, functions, classes, etc.)
  * Expressions (calls, assignments, etc.)
  * TypeScript-specific elements (interfaces, type aliases, etc.)
- Cyclomatic complexity 
- Maintainability index (0-100 scale)
- Function-level metrics
- Class metrics including inheritance depth

Output formats: text (detailed) or markdown table (concise).`,
        inputSchema: convertSchema(TypescriptAnalyzeFileSchema),
      },
      {
        name: ToolName.TYPESCRIPT_ANALYZE_DIRECTORY,
        description: `Recursively analyzes TypeScript files in a directory for code quality patterns.

Per-file metrics:
- Logical Lines of Code (LLOC): Counts executable code elements including:
  * Statements (if, loops, return, etc.)
  * Declarations (variables, functions, classes, etc.)
  * Expressions (calls, assignments, etc.)
  * TypeScript-specific elements (interfaces, type aliases, etc.)
- Cyclomatic complexity
- Maintainability index (0-100 scale)
- Optional function-level analysis
- Class metrics

Results help identify:
- Complex code needing refactoring
- Maintainability issues
- Deep inheritance chains

Output as markdown tables with file summaries and optional function details.

Respects .gitignore and common ignore patterns.`,
        inputSchema: convertSchema(TypescriptAnalyzeDirectorySchema),
      },
    ];

    return { tools };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const handler = handlers[name as ToolName];

    if (!handler) {
      return {
        isError: true,
        content: [{ type: "text", text: `Unknown tool: ${name}` }],
      };
    }

    return handler(args);
  });

  return server;
}

const cleanupHandlers = new Set<() => Promise<void>>();

export async function startup() {
  // Create and start server
  const transport = new StdioServerTransport();
  const server = await createServer();

  // Register cleanup handler
  cleanupHandlers.add(async () => {
    await transport.close();
  });

  // Connect server
  try {
    await server.connect(transport);
  } catch (error) {
    console.error("Failed to start server:", error);
  }
}
