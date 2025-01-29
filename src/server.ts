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
        name: "analyze_file",
        description: "Comprehensive analysis of a single TypeScript file, including file metrics and detailed function analysis",
        inputSchema: {
          type: "object",
          properties: {
            filepath: {
              type: "string",
              description: "Path to the TypeScript file to analyze",
            },
            format: {
              type: "string",
              description: "Output format: 'text' for readable output or 'table' for markdown table",
              enum: ["text", "table"],
              default: "text"
            }
          },
          required: ["filepath"],
        },
      },
      {
        name: "analyze_directory",
        description: "Comprehensive analysis of all TypeScript files in a directory, including file and function metrics",
        inputSchema: {
          type: "object",
          properties: {
            directory: {
              type: "string",
              description: "Directory path to scan for TypeScript files",
            },
            include_functions: {
              type: "boolean",
              description: "Whether to include function-level metrics in the output",
              default: true
            }
          },
          required: ["directory"],
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  switch (request.params.name) {
    case "analyze_file": {
      const { filepath, format = 'text' } = request.params.arguments as { filepath: string, format?: 'text' | 'table' };
      try {
        const code = await fs.readFile(filepath, 'utf-8');
        const analysis = analyzeFile(code, filepath);
        
        if (format === 'table') {
          // Generate table format
          let tableRows = [
            '| Scope | Name | Type | Lines | LOC | Complexity | Maintainability | Methods | Avg Complexity |',
            '|--------|------|------|-------|-----|------------|----------------|----------|----------------|',
            // File level metrics
            `| file | ${path.basename(filepath)} | - | - | ${analysis.fileMetrics.linesOfCode} | ${analysis.fileMetrics.cyclomaticComplexity} | ${analysis.fileMetrics.maintainabilityIndex.toFixed(2)} | ${analysis.fileMetrics.methodCount} | ${analysis.fileMetrics.averageMethodComplexity.toFixed(2)} |`
          ];
          
          // Function level metrics
          for (const fn of analysis.functions) {
            tableRows.push(
              `| function | ${fn.name} | ${fn.type} | ${fn.startLine}-${fn.endLine} | ${fn.metrics.linesOfCode} | ${fn.metrics.cyclomaticComplexity} | ${fn.metrics.maintainabilityIndex.toFixed(2)} | ${fn.metrics.methodCount} | ${fn.metrics.averageMethodComplexity.toFixed(2)} |`
            );
          }
          
          return {
            content: [{ type: "text", text: tableRows.join('\n') }]
          };
        } else {
          // Generate text format
          const fileText = `File: ${filepath}
Metrics:
- Lines of Code: ${analysis.fileMetrics.linesOfCode}
- Cyclomatic Complexity: ${analysis.fileMetrics.cyclomaticComplexity}
- Maintainability Index: ${analysis.fileMetrics.maintainabilityIndex.toFixed(2)}
- Class Count: ${analysis.fileMetrics.classCount}
- Method Count: ${analysis.fileMetrics.methodCount}
- Average Method Complexity: ${analysis.fileMetrics.averageMethodComplexity.toFixed(2)}
- Depth of Inheritance: ${analysis.fileMetrics.depthOfInheritance}

Functions:`;

          const functionsText = analysis.functions
            .map(fn => `
  ${fn.name} (${fn.type})
  Lines: ${fn.startLine}-${fn.endLine}
  - Lines of Code: ${fn.metrics.linesOfCode}
  - Cyclomatic Complexity: ${fn.metrics.cyclomaticComplexity}
  - Maintainability Index: ${fn.metrics.maintainabilityIndex.toFixed(2)}
  - Methods: ${fn.metrics.methodCount}
  - Average Method Complexity: ${fn.metrics.averageMethodComplexity.toFixed(2)}`
            ).join('\n');

          return {
            content: [{ type: "text", text: `${fileText}${functionsText}` }]
          };
        }
      } catch (error) {
        return {
          isError: true,
          content: [{ type: "text", text: `Error analyzing file: ${error}` }]
        };
      }
    }

    case "analyze_directory": {
      const { directory, include_functions = true } = request.params.arguments as { 
        directory: string, 
        include_functions?: boolean 
      };
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
          
          // Add function-level metrics if requested
          if (include_functions) {
            for (const fn of analysis.functions) {
              tableRows.push(
                `| ${relativePath} | function | ${fn.name} | ${fn.type} | ${fn.startLine}-${fn.endLine} | ${fn.metrics.linesOfCode} | ${fn.metrics.cyclomaticComplexity} | ${fn.metrics.maintainabilityIndex.toFixed(2)} | ${fn.metrics.methodCount} | ${fn.metrics.averageMethodComplexity.toFixed(2)} |`
              );
            }
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
              text: `Error analyzing directory: ${error}`,
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