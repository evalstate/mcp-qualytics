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

export const createServer = () => {
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
- 0-20: Very difficult to maintain
- 21-40: Difficult to maintain
- 41-60: Moderately maintainable
- 61-80: Highly maintainable 
- 81-100: Extremely maintainable

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
- 0-20: Very difficult to maintain
- 21-40: Difficult to maintain
- 41-60: Moderately maintainable
- 61-80: Highly maintainable 
- 81-100: Extremely maintainable

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

  const cleanup = async () => {
    // No cleanup needed currently
  };

  return { server, cleanup };
};

// Start the server if run directly
if (process.argv[1] === import.meta.url.substring(7)) {
  async function main() {
    const transport = new StdioServerTransport();
    const { server, cleanup } = createServer();
    
    async function handleShutdown(reason: string = 'unknown') {
      console.error(`Initiating shutdown (reason: ${reason})`);
      try {
        await cleanup();
        await transport.close();
        process.exit(0);
      } catch (error) {
        console.error('Error during shutdown:', error);
        process.exit(1);
      }
    }
    
    transport.onclose = () => {
      handleShutdown('transport closed');
    };
    
    process.stdin.on('end', () => handleShutdown('stdin ended'));
    process.stdin.on('close', () => handleShutdown('stdin closed'));
    process.stdout.on('error', () => handleShutdown('stdout error'));
    process.stdout.on('close', () => handleShutdown('stdout closed'));
    
    try {
      await server.connect(transport);
      console.error('Server connected');
    } catch (error) {
      console.error('Failed to connect server:', error);
      handleShutdown('connection failed');
    }
  }
  
  main().catch((error) => {
    console.error("Fatal error in main():", error);
    process.exit(1);
  });
}