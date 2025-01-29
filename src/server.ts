#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { promises as fs } from 'fs';
import path from 'path';
import { calculateMetrics, analyzeFile } from './metrics.js';

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

// Helper function to find TypeScript files recursively
async function findTypeScriptFiles(dir: string): Promise<string[]> {
  const files: string[] = [];
  
  async function scan(directory: string) {
    const entries = await fs.readdir(directory, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(directory, entry.name);
      
      if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
        await scan(fullPath);
      } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
        files.push(fullPath);
      }
    }
  }
  
  await scan(dir);
  return files;
}

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "get_combined_metrics_table",
        description: "Get a markdown table of metrics for all files and their functions in a directory",
        inputSchema: {
          type: "object",
          properties: {
            directory: {
              type: "string",
              description: "Directory path to scan for TypeScript files",
            },
          },
          required: ["directory"],
        },
      },
      {
        name: "list_typescript_files",
        description: "Lists all TypeScript files in the specified directory",
        inputSchema: {
          type: "object",
          properties: {
            directory: {
              type: "string",
              description: "Directory path to scan for TypeScript files",
            },
          },
          required: ["directory"],
        },
      },
      {
        name: "get_file_metrics",
        description: "Get metrics for a specific TypeScript file",
        inputSchema: {
          type: "object",
          properties: {
            filepath: {
              type: "string",
              description: "Path to the TypeScript file to analyze",
            },
          },
          required: ["filepath"],
        },
      },
      {
        name: "get_function_metrics",
        description: "Get detailed metrics for each function in a TypeScript file",
        inputSchema: {
          type: "object",
          properties: {
            filepath: {
              type: "string",
              description: "Path to the TypeScript file to analyze",
            },
          },
          required: ["filepath"],
        },
      },
      {
        name: "get_metrics_table",
        description: "Get a markdown table of metrics for all TypeScript files in a directory",
        inputSchema: {
          type: "object",
          properties: {
            directory: {
              type: "string",
              description: "Directory path to scan for TypeScript files",
            },
          },
          required: ["directory"],
        },
      },
      {
        name: "get_function_metrics_table",
        description: "Get a markdown table of metrics for all functions in a TypeScript file",
        inputSchema: {
          type: "object",
          properties: {
            filepath: {
              type: "string",
              description: "Path to the TypeScript file to analyze",
            },
          },
          required: ["filepath"],
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  switch (request.params.name) {
    case "list_typescript_files": {
      const { directory } = request.params.arguments as { directory: string };
      try {
        const files = await findTypeScriptFiles(directory);
        return {
          content: [
            {
              type: "text",
              text: "Found TypeScript files:\n" + files.join('\n'),
            },
          ],
        };
      } catch (error) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Error listing files: ${error}`,
            },
          ],
        };
      }
    }

    case "get_file_metrics": {
      const { filepath } = request.params.arguments as { filepath: string };
      try {
        const code = await fs.readFile(filepath, 'utf-8');
        const metrics = calculateMetrics(code, filepath);
        return {
          content: [
            {
              type: "text",
              text: `Metrics for ${filepath}:
- Lines of Code: ${metrics.linesOfCode}
- Cyclomatic Complexity: ${metrics.cyclomaticComplexity}
- Maintainability Index: ${metrics.maintainabilityIndex.toFixed(2)}
- Class Count: ${metrics.classCount}
- Method Count: ${metrics.methodCount}
- Average Method Complexity: ${metrics.averageMethodComplexity.toFixed(2)}
- Depth of Inheritance: ${metrics.depthOfInheritance}`,
            },
          ],
        };
      } catch (error) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Error analyzing file: ${error}`,
            },
          ],
        };
      }
    }

    case "get_function_metrics": {
      const { filepath } = request.params.arguments as { filepath: string };
      try {
        const code = await fs.readFile(filepath, 'utf-8');
        const analysis = analyzeFile(code, filepath);
        
        const functionsText = analysis.functions
          .map(fn => `
Function: ${fn.name} (${fn.type})
Lines: ${fn.startLine}-${fn.endLine}
- Lines of Code: ${fn.metrics.linesOfCode}
- Cyclomatic Complexity: ${fn.metrics.cyclomaticComplexity}
- Maintainability Index: ${fn.metrics.maintainabilityIndex.toFixed(2)}
- Class Count: ${fn.metrics.classCount}
- Method Count: ${fn.metrics.methodCount}
- Average Method Complexity: ${fn.metrics.averageMethodComplexity.toFixed(2)}
- Depth of Inheritance: ${fn.metrics.depthOfInheritance}`)
          .join('\n');

        return {
          content: [
            {
              type: "text",
              text: `File: ${filepath}\n\nFunctions:\n${functionsText}`,
            },
          ],
        };
      } catch (error) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Error analyzing functions: ${error}`,
            },
          ],
        };
      }
    }

    case "get_metrics_table": {
      const { directory } = request.params.arguments as { directory: string };
      try {
        const files = await findTypeScriptFiles(directory);
        let tableRows = ['| File | LOC | Complexity | Maintainability | Classes | Methods | Avg Method Complexity | Inheritance |'];
        tableRows.push('|------|-----|------------|----------------|----------|----------|---------------------|-------------|');

        for (const file of files) {
          const code = await fs.readFile(file, 'utf-8');
          const metrics = calculateMetrics(code, file);
          const relativePath = path.relative(directory, file);
          tableRows.push(
            `| ${relativePath} | ${metrics.linesOfCode} | ${metrics.cyclomaticComplexity} | ${metrics.maintainabilityIndex.toFixed(2)} | ${metrics.classCount} | ${metrics.methodCount} | ${metrics.averageMethodComplexity.toFixed(2)} | ${metrics.depthOfInheritance} |`
          );
        }

        return {
          content: [
            {
              type: "text",
              text: tableRows.join('\n'),
            },
          ],
        };
      } catch (error) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Error generating metrics table: ${error}`,
            },
          ],
        };
      }
    }

    case "get_function_metrics_table": {
      const { filepath } = request.params.arguments as { filepath: string };
      try {
        const code = await fs.readFile(filepath, 'utf-8');
        const analysis = analyzeFile(code, filepath);
        
        let tableRows = ['| Function | Type | Lines | LOC | Complexity | Maintainability | Methods | Avg Complexity |'];
        tableRows.push('|----------|------|-------|-----|------------|----------------|----------|----------------|');

        for (const fn of analysis.functions) {
          tableRows.push(
            `| ${fn.name} | ${fn.type} | ${fn.startLine}-${fn.endLine} | ${fn.metrics.linesOfCode} | ${fn.metrics.cyclomaticComplexity} | ${fn.metrics.maintainabilityIndex.toFixed(2)} | ${fn.metrics.methodCount} | ${fn.metrics.averageMethodComplexity.toFixed(2)} |`
          );
        }

        return {
          content: [
            {
              type: "text",
              text: tableRows.join('\n'),
            },
          ],
        };
      } catch (error) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Error generating function metrics table: ${error}`,
            },
          ],
        };
      }
    }

    case "get_combined_metrics_table": {
      const { directory } = request.params.arguments as { directory: string };
      try {
        const files = await findTypeScriptFiles(directory);
        let tableRows = ['| File | Scope | Name | Type | Lines | LOC | Complexity | Maintainability | Methods | Avg Complexity |'];
        tableRows.push('|------|--------|------|------|-------|-----|------------|----------------|----------|----------------|');

        for (const file of files) {
          const code = await fs.readFile(file, 'utf-8');
          const analysis = analyzeFile(code, file);
          const relativePath = path.relative(directory, file);
          
          // Add file-level metrics
          tableRows.push(
            `| ${relativePath} | file | - | - | - | ${analysis.fileMetrics.linesOfCode} | ${analysis.fileMetrics.cyclomaticComplexity} | ${analysis.fileMetrics.maintainabilityIndex.toFixed(2)} | ${analysis.fileMetrics.methodCount} | ${analysis.fileMetrics.averageMethodComplexity.toFixed(2)} |`
          );
          
          // Add function-level metrics
          for (const fn of analysis.functions) {
            tableRows.push(
              `| ${relativePath} | function | ${fn.name} | ${fn.type} | ${fn.startLine}-${fn.endLine} | ${fn.metrics.linesOfCode} | ${fn.metrics.cyclomaticComplexity} | ${fn.metrics.maintainabilityIndex.toFixed(2)} | ${fn.metrics.methodCount} | ${fn.metrics.averageMethodComplexity.toFixed(2)} |`
            );
          }
        }

        return {
          content: [
            {
              type: "text",
              text: tableRows.join('\n'),
            },
          ],
        };
      } catch (error) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Error generating combined metrics table: ${error}`,
            },
          ],
        };
      }
    }

    default:
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: `Unknown tool: ${request.params.name}`,
          },
        ],
      };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  
  async function handleShutdown(reason = 'unknown') {    
    console.error(`Initiating shutdown (reason: ${reason})`);

    try {
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