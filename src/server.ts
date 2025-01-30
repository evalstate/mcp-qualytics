#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
  ToolSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { zodToJsonSchema } from "zod-to-json-schema";

import {
  TypescriptAnalyzeTextSchema,
  TypescriptAnalyzeFileSchema,
  TypescriptAnalyzeDirectorySchema,
  ToolName
} from './schemas.js';
import { handlers } from './handlers.js';

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
      version: "0.1.0",
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
        description: `Performs a detailed code quality analysis of TypeScript code provided as text.

Analysis includes:
- File-level metrics:
  * Lines of Code (LOC): Count of logical code lines including:
    - Declarations (variables, functions, classes, interfaces)
    - Executable statements
    - Import/export statements
    - Parameter properties in constructors
    (excluding comments, empty lines, and standalone braces)
  * Cyclomatic complexity
  * Maintainability index
- Function-level analysis: complexity, maintainability per function
- Class analysis: inheritance depth, method counts
- Detailed metrics for each function and method

The maintainability index is on a scale of 0-100, where:
- 20-100: Good maintainability (indicates the code has good maintainability)
- 10-19: Moderate maintainability (indicates the code could benefit from some improvement)
- 0-9: Poor maintainability (indicates the code requires significant refactoring)

This metric is aligned with Visual Studio's maintainability index ranges and helps identify areas that may need attention while avoiding overly harsh assessments.

Output can be formatted as human-readable text or as a markdown table for better visualization.

Can analyze both complete TypeScript files and individual functions/methods.`,
        inputSchema: convertSchema(TypescriptAnalyzeTextSchema),
      },
      {
        name: ToolName.TYPESCRIPT_ANALYZE_FILE,
        description: `Performs a detailed code quality analysis of a single TypeScript file.

Analysis includes:
- File-level metrics:
  * Lines of Code (LOC): Count of logical code lines including:
    - Declarations (variables, functions, classes, interfaces)
    - Executable statements
    - Import/export statements
    - Parameter properties in constructors
    (excluding comments, empty lines, and standalone braces)
  * Cyclomatic complexity
  * Maintainability index
- Function-level analysis: complexity, maintainability per function
- Class analysis: inheritance depth, method counts
- Detailed metrics for each function and method

The maintainability index is on a scale of 0-100, where:
- 20-100: Good maintainability (indicates the code has good maintainability)
- 10-19: Moderate maintainability (indicates the code could benefit from some improvement)
- 0-9: Poor maintainability (indicates the code requires significant refactoring)

This metric is aligned with Visual Studio's maintainability index ranges and helps identify areas that may need attention while avoiding overly harsh assessments.

Output can be formatted as human-readable text or as a markdown table for better visualization.`,
        inputSchema: convertSchema(TypescriptAnalyzeFileSchema),
      },
      {
        name: ToolName.TYPESCRIPT_ANALYZE_DIRECTORY,
        description: `Recursively analyzes all TypeScript files in a directory to identify code quality patterns and potential issues.

Provides a comprehensive overview of:
- Code quality metrics for each file:
  * Lines of Code (LOC): Count of logical code lines including:
    - Declarations (variables, functions, classes, interfaces)
    - Executable statements
    - Import/export statements
    - Parameter properties in constructors
    (excluding comments, empty lines, and standalone braces)
  * Cyclomatic complexity
  * Maintainability index
- Function-level analysis (optional)
- Project-wide patterns and potential issues
- Relative complexity between files

The maintainability index is on a scale of 0-100, where:
- 20-100: Good maintainability (indicates the code has good maintainability)
- 10-19: Moderate maintainability (indicates the code could benefit from some improvement)
- 0-9: Poor maintainability (indicates the code requires significant refactoring)

This metric is aligned with Visual Studio's maintainability index ranges and helps identify areas that may need attention while avoiding overly harsh assessments.

The analysis helps identify:
- Complex files that may need refactoring
- Inconsistent code patterns
- Files with maintainability issues
- Deep inheritance hierarchies

Results are presented in a markdown table format for easy comparison between files and functions.
Use include_functions=false for a higher-level overview of just file metrics.

Files are filtered based on:
- .gitignore patterns if present
- Default ignored patterns (node_modules, .*, dist, build, out)
- Additional ignore patterns if specified`,
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

let shuttingDown = false;
const cleanupHandlers = new Set<() => Promise<void>>();

export async function startup() {
  // Setup error handlers
  process.on("uncaughtException", shutdown);
  process.on("unhandledRejection", shutdown);
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("exit", () => shutdown("exit"));

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
    console.error("Server started successfully");
  } catch (error) {
    console.error("Failed to start server:", error);
    await shutdown("startup failed");
  }
}

export async function shutdown(reason = "unknown") {
  if (shuttingDown) return;
  shuttingDown = true;

  console.error(`Shutting down (reason: ${reason})`);

  try {
    await Promise.all(Array.from(cleanupHandlers).map((h) => h()));
  } catch (error) {
    console.error("Error during shutdown:", error);
    process.exit(1);
  }

  process.exit(0);
}