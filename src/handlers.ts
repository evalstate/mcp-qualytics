import { promises as fs } from 'fs';
import path from 'path';
import { analyzeFile as typescriptAnalyzeFile } from './metrics/index.js';
import { findTypeScriptFiles, formatAnalysisTable } from './utils.js';
import {
  TypescriptAnalyzeTextSchema,
  TypescriptAnalyzeFileSchema,
  TypescriptAnalyzeDirectorySchema,
  ToolName
} from './schemas.js';
import type { 
  Content, 
  DirectoryAnalysis, 
  AnalysisResult 
} from './types.js';
import { OutputFormat } from './types.js';

function createContent(analysis: AnalysisResult, format: OutputFormat, filename?: string): Content {
  return format === OutputFormat.Table
    ? { type: "text", text: formatAnalysisTable(analysis, filename) }
    : { type: "json", json: analysis };
}

function createErrorContent(error: unknown): Content {
  return { 
    type: "text", 
    text: `Error: ${error instanceof Error ? error.message : String(error)}` 
  };
}

export async function handleAnalyzeText(args: unknown) {
  try {
    const validatedArgs = TypescriptAnalyzeTextSchema.parse(args);
    const analysis = typescriptAnalyzeFile(validatedArgs.code, "input.ts");
    return { 
      content: [createContent(analysis, validatedArgs.format as OutputFormat)] 
    };
  } catch (error) {
    return {
      isError: true,
      content: [createErrorContent(error)]
    };
  }
}

export async function handleAnalyzeFile(args: unknown) {
  try {
    const validatedArgs = TypescriptAnalyzeFileSchema.parse(args);
    const code = await fs.readFile(validatedArgs.filepath, 'utf-8');
    const analysis = typescriptAnalyzeFile(code, validatedArgs.filepath);
    
    const content: Content[] = [
      createContent(analysis, validatedArgs.format as OutputFormat, path.basename(validatedArgs.filepath))
    ];
    
    if (validatedArgs.include_source) {
      content.push({
        type: "resource",
        resource: {
          uri: validatedArgs.filepath,
          mimeType: "application/x-typescript",
          text: code
        }
      });
    }
    
    return { content };
  } catch (error) {
    return {
      isError: true,
      content: [createErrorContent(error)]
    };
  }
}

async function analyzeDirectory(directory: string, includeFunctions: boolean): Promise<DirectoryAnalysis> {
  const files = await findTypeScriptFiles(directory);
  
  const analysisResults = await Promise.all(
    files.map(async (file) => {
      const code = await fs.readFile(file, 'utf-8');
      const analysis = typescriptAnalyzeFile(code, file);
      const relativePath = path.relative(directory, file);
      
      return {
        path: relativePath,
        analysis,
        includeFunctions
      };
    })
  );
  
  return {
    directoryPath: directory,
    files: analysisResults
  };
}

function formatDirectoryAnalysis(analysis: DirectoryAnalysis, format: OutputFormat): Content {
  if (format === OutputFormat.Json) {
    return { type: "json", json: analysis };
  }

  const tableRows = [
    '| File | Scope | Name | Type | Lines | LOC | Complexity | Maintainability | Classes | Methods | Avg Complexity | Inheritance Depth |',
    '|------|--------|------|------|-------|-----|------------|----------------|----------|----------|----------------|------------------|'
  ];
  
  for (const file of analysis.files) {
    const metrics = file.analysis.fileMetrics;
    tableRows.push(
      `| ${file.path} | file | - | - | - | ${metrics.linesOfCode} | ${metrics.cyclomaticComplexity} | ${metrics.maintainabilityIndex.toFixed(2)} | ${metrics.classCount} | ${metrics.methodCount} | ${metrics.averageMethodComplexity.toFixed(2)} | ${metrics.depthOfInheritance} |`
    );
    
    if (file.includeFunctions) {
      for (const fn of file.analysis.functions) {
        tableRows.push(
          `| ${file.path} | function | ${fn.name} | ${fn.type} | ${fn.startLine}-${fn.endLine} | ${fn.metrics.linesOfCode} | ${fn.metrics.cyclomaticComplexity} | ${fn.metrics.maintainabilityIndex.toFixed(2)} | - | ${fn.metrics.methodCount} | ${fn.metrics.averageMethodComplexity.toFixed(2)} | - |`
        );
      }
    }
  }
  
  return { type: "text", text: tableRows.join('\n') };
}

export async function handleAnalyzeDirectory(args: unknown) {
  try {
    const validatedArgs = TypescriptAnalyzeDirectorySchema.parse(args);
    const analysis = await analyzeDirectory(
      validatedArgs.directory,
      validatedArgs.include_functions
    );
    
    return {
      content: [formatDirectoryAnalysis(analysis, validatedArgs.format as OutputFormat)]
    };
  } catch (error) {
    return {
      isError: true,
      content: [createErrorContent(error)]
    };
  }
}

export const handlers = {
  [ToolName.TYPESCRIPT_ANALYZE_TEXT]: handleAnalyzeText,
  [ToolName.TYPESCRIPT_ANALYZE_FILE]: handleAnalyzeFile,
  [ToolName.TYPESCRIPT_ANALYZE_DIRECTORY]: handleAnalyzeDirectory
};