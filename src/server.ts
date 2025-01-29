#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { promises as fs } from 'fs';
import path from 'path';
import ignore from 'ignore';
import { analyzeFile as typescriptAnalyzeFile } from './metrics/index.js';

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
async function findTypeScriptFiles(dir: string, additionalIgnorePatterns: string[] = []): Promise<string[]> {
  const files: string[] = [];
  
  // Initialize ignore instance
  const ig = ignore();
  
  // Try to load .gitignore if it exists
  try {
    const gitignorePath = path.join(dir, '.gitignore');
    const gitignoreContent = await fs.readFile(gitignorePath, 'utf8');
    ig.add(gitignoreContent);
  } catch (error) {
    // No .gitignore found or error reading it - continue without ignore patterns
  }
  
  // Always ignore node_modules and hidden directories
  ig.add(['node_modules', '.*/', 'dist', 'build', 'out']);
  
  // Add any additional ignore patterns
  if (additionalIgnorePatterns.length > 0) {
    ig.add(additionalIgnorePatterns);
  }
  
  async function scan(directory: string) {
    const entries = await fs.readdir(directory, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(directory, entry.name);
      const relativePath = path.relative(dir, fullPath);
      
      // Skip if path matches ignore patterns
      if (ig.ignores(relativePath)) {
        continue;
      }
      
      if (entry.isDirectory()) {
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
        name: "typescript_analyze_text",
        description: `Performs a detailed code quality analysis of TypeScript code provided as text.

Analysis includes:
- File-level metrics: LOC, cyclomatic complexity, maintainability index
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
        inputSchema: {
          type: "object",
          properties: {
            code: {
              type: "string",
              description: "TypeScript code to analyze",
            },
            format: {
              type: "string",
              description: "Output format: 'text' for detailed readable output with descriptions, or 'table' for a concise markdown table format",
              enum: ["text", "table"],
              default: "text"
            }
          },
          required: ["code"],
        },
      },
      {
        name: "typescript_analyze_file",
        description: `Performs a detailed code quality analysis of a single TypeScript file.

Analysis includes:
- File-level metrics: LOC, cyclomatic complexity, maintainability index
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
        inputSchema: {
          type: "object",
          properties: {
            filepath: {
              type: "string",
              description: "Absolute or relative path to the TypeScript file to analyze",
            },
            format: {
              type: "string",
              description: "Output format: 'text' for detailed readable output with descriptions, or 'table' for a concise markdown table format",
              enum: ["text", "table"],
              default: "text"
            },
            include_source: {
              type: "boolean",
              description: "When true, includes the source file as an embedded resource",
              default: false
            }
          },
          required: ["filepath"],
        },
      },
      {
        name: "typescript_analyze_directory",
        description: `Recursively analyzes all TypeScript files in a directory to identify code quality patterns and potential issues.

Provides a comprehensive overview of:
- Code quality metrics for each file
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
        inputSchema: {
          type: "object",
          properties: {
            directory: {
              type: "string",
              description: "Absolute or relative path to the directory containing TypeScript files. Will recursively search subdirectories, excluding node_modules and hidden directories.",
            },
            include_functions: {
              type: "boolean",
              description: "When true, includes detailed metrics for every function/method in each file. Set to false for a more concise file-level overview.",
              default: true
            },
            ignore_patterns: {
              type: "array",
              description: "Optional array of glob patterns to ignore (in addition to .gitignore and defaults). Example: ['test/**', '**/*.test.ts']",
              items: {
                type: "string"
              },
              default: []
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
    case "typescript_analyze_text": {
      const { code, format = 'text' } = request.params.arguments as { code: string, format?: 'text' | 'table' };
      try {
        const analysis = typescriptAnalyzeFile(code, "input.ts");  // Using placeholder filename
        
        if (format === 'table') {
          // Generate table format
          let tableRows = [
            '| Scope | Name | Type | Lines | LOC | Complexity | Maintainability | Classes | Methods | Avg Complexity | Inheritance Depth |',
            '|--------|------|------|-------|-----|------------|----------------|----------|----------|----------------|------------------|',
            // File level metrics
            `| file | input | - | - | ${analysis.fileMetrics.linesOfCode} | ${analysis.fileMetrics.cyclomaticComplexity} | ${analysis.fileMetrics.maintainabilityIndex.toFixed(2)} | ${analysis.fileMetrics.classCount} | ${analysis.fileMetrics.methodCount} | ${analysis.fileMetrics.averageMethodComplexity.toFixed(2)} | ${analysis.fileMetrics.depthOfInheritance} |`
          ];
          
          // Function level metrics
          for (const fn of analysis.functions) {
            tableRows.push(
              `| function | ${fn.name} | ${fn.type} | ${fn.startLine}-${fn.endLine} | ${fn.metrics.linesOfCode} | ${fn.metrics.cyclomaticComplexity} | ${fn.metrics.maintainabilityIndex.toFixed(2)} | - | ${fn.metrics.methodCount} | ${fn.metrics.averageMethodComplexity.toFixed(2)} | - |`
            );
          }
          
          return {
            content: [{ type: "text", text: tableRows.join('\n') }]
          };
        } else {
          // Generate text format
          const fileText = `Analysis Results:
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
          content: [{ type: "text", text: `Error analyzing code: ${error}` }]
        };
      }
    }

    case "typescript_analyze_file": {
      const { filepath, format = 'text', include_source = false } = request.params.arguments as { 
        filepath: string, 
        format?: 'text' | 'table',
        include_source?: boolean 
      };
      try {
        const code = await fs.readFile(filepath, 'utf-8');
        const analysis = typescriptAnalyzeFile(code, filepath);
        
        const content = [];
        
        if (format === 'table') {
          // Generate table format
          let tableRows = [
            '| Scope | Name | Type | Lines | LOC | Complexity | Maintainability | Classes | Methods | Avg Complexity | Inheritance Depth |',
            '|--------|------|------|-------|-----|------------|----------------|----------|----------|----------------|------------------|',
            // File level metrics
            `| file | ${path.basename(filepath)} | - | - | ${analysis.fileMetrics.linesOfCode} | ${analysis.fileMetrics.cyclomaticComplexity} | ${analysis.fileMetrics.maintainabilityIndex.toFixed(2)} | ${analysis.fileMetrics.classCount} | ${analysis.fileMetrics.methodCount} | ${analysis.fileMetrics.averageMethodComplexity.toFixed(2)} | ${analysis.fileMetrics.depthOfInheritance} |`
          ];
          
          // Function level metrics
          for (const fn of analysis.functions) {
            tableRows.push(
              `| function | ${fn.name} | ${fn.type} | ${fn.startLine}-${fn.endLine} | ${fn.metrics.linesOfCode} | ${fn.metrics.cyclomaticComplexity} | ${fn.metrics.maintainabilityIndex.toFixed(2)} | - | ${fn.metrics.methodCount} | ${fn.metrics.averageMethodComplexity.toFixed(2)} | - |`
            );
          }
          
          content.push({ type: "text", text: tableRows.join('\n') });
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

          content.push({ type: "text", text: `${fileText}${functionsText}` });
        }

        // Add source file as embedded resource if requested
        if (include_source) {
          console.error('Adding source file as resource:', filepath);
          content.push({
            type: "resource",
            uri: filepath,
            mimeType: "application/x-typescript",
            text: code
          });
          console.error('Content array length:', content.length);
        }

        const response = { content };
        console.error('Final response:', JSON.stringify(response));
        return response;
      } catch (error) {
        return {
          isError: true,
          content: [{ type: "text", text: `Error analyzing file: ${error}` }]
        };
      }
    }

    case "typescript_analyze_directory": {
      const { directory, include_functions = true, ignore_patterns = [] } = request.params.arguments as { 
        directory: string, 
        include_functions?: boolean,
        ignore_patterns?: string[]
      };
      try {
        const files = await findTypeScriptFiles(directory, ignore_patterns);
        let tableRows = ['| File | Scope | Name | Type | Lines | LOC | Complexity | Maintainability | Classes | Methods | Avg Complexity | Inheritance Depth |'];
        tableRows.push('|------|--------|------|------|-------|-----|------------|----------------|----------|----------|----------------|------------------|');

        for (const file of files) {
          const code = await fs.readFile(file, 'utf-8');
          const analysis = typescriptAnalyzeFile(code, file);
          const relativePath = path.relative(directory, file);
          
          // Add file-level metrics
          tableRows.push(
            `| ${relativePath} | file | - | - | - | ${analysis.fileMetrics.linesOfCode} | ${analysis.fileMetrics.cyclomaticComplexity} | ${analysis.fileMetrics.maintainabilityIndex.toFixed(2)} | ${analysis.fileMetrics.classCount} | ${analysis.fileMetrics.methodCount} | ${analysis.fileMetrics.averageMethodComplexity.toFixed(2)} | ${analysis.fileMetrics.depthOfInheritance} |`
          );
          
          // Add function-level metrics if requested
          if (include_functions) {
            for (const fn of analysis.functions) {
              tableRows.push(
                `| ${relativePath} | function | ${fn.name} | ${fn.type} | ${fn.startLine}-${fn.endLine} | ${fn.metrics.linesOfCode} | ${fn.metrics.cyclomaticComplexity} | ${fn.metrics.maintainabilityIndex.toFixed(2)} | - | ${fn.metrics.methodCount} | ${fn.metrics.averageMethodComplexity.toFixed(2)} | - |`
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
  
  async function handleShutdown(reason: string = 'unknown') {    
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