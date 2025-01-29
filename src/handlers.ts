import { promises as fs } from 'fs';
import path from 'path';
import { analyzeFile as typescriptAnalyzeFile } from './metrics/index.js';
import { findTypeScriptFiles, formatAnalysisTable, formatAnalysisText } from './utils.js';
import {
  TypescriptAnalyzeTextSchema,
  TypescriptAnalyzeFileSchema,
  TypescriptAnalyzeDirectorySchema,
  ToolName
} from './schemas.js';

export async function handleAnalyzeText(args: unknown) {
  try {
    const validatedArgs = TypescriptAnalyzeTextSchema.parse(args);
    const analysis = typescriptAnalyzeFile(validatedArgs.code, "input.ts");
    
    const text = validatedArgs.format === 'table' 
      ? formatAnalysisTable(analysis)
      : formatAnalysisText(analysis);
    
    return {
      content: [{ type: "text", text }]
    };
  } catch (error) {
    return {
      isError: true,
      content: [{ type: "text", text: `Error analyzing code: ${error}` }]
    };
  }
}

export async function handleAnalyzeFile(args: unknown) {
  try {
    const validatedArgs = TypescriptAnalyzeFileSchema.parse(args);
    const code = await fs.readFile(validatedArgs.filepath, 'utf-8');
    const analysis = typescriptAnalyzeFile(code, validatedArgs.filepath);
    
    const content = [];
    
    // Add analysis results
    const text = validatedArgs.format === 'table'
      ? formatAnalysisTable(analysis, path.basename(validatedArgs.filepath))
      : formatAnalysisText(analysis, validatedArgs.filepath);
    
    content.push({ type: "text", text });
    
    // Add source file as embedded resource if requested
    if (validatedArgs.include_source) {
      content.push({
        type: "resource",
        uri: validatedArgs.filepath,
        mimeType: "application/x-typescript",
        text: code
      });
    }
    
    return { content };
  } catch (error) {
    return {
      isError: true,
      content: [{ type: "text", text: `Error analyzing file: ${error}` }]
    };
  }
}

export async function handleAnalyzeDirectory(args: unknown) {
  try {
    const validatedArgs = TypescriptAnalyzeDirectorySchema.parse(args);
    const files = await findTypeScriptFiles(validatedArgs.directory, validatedArgs.ignore_patterns);
    
    let tableRows = [
      '| File | Scope | Name | Type | Lines | LOC | Complexity | Maintainability | Classes | Methods | Avg Complexity | Inheritance Depth |',
      '|------|--------|------|------|-------|-----|------------|----------------|----------|----------|----------------|------------------|'
    ];
    
    for (const file of files) {
      const code = await fs.readFile(file, 'utf-8');
      const analysis = typescriptAnalyzeFile(code, file);
      const relativePath = path.relative(validatedArgs.directory, file);
      
      // Add file-level metrics
      tableRows.push(
        `| ${relativePath} | file | - | - | - | ${analysis.fileMetrics.linesOfCode} | ${analysis.fileMetrics.cyclomaticComplexity} | ${analysis.fileMetrics.maintainabilityIndex.toFixed(2)} | ${analysis.fileMetrics.classCount} | ${analysis.fileMetrics.methodCount} | ${analysis.fileMetrics.averageMethodComplexity.toFixed(2)} | ${analysis.fileMetrics.depthOfInheritance} |`
      );
      
      // Add function-level metrics if requested
      if (validatedArgs.include_functions) {
        for (const fn of analysis.functions) {
          tableRows.push(
            `| ${relativePath} | function | ${fn.name} | ${fn.type} | ${fn.startLine}-${fn.endLine} | ${fn.metrics.linesOfCode} | ${fn.metrics.cyclomaticComplexity} | ${fn.metrics.maintainabilityIndex.toFixed(2)} | - | ${fn.metrics.methodCount} | ${fn.metrics.averageMethodComplexity.toFixed(2)} | - |`
          );
        }
      }
    }
    
    return {
      content: [{ type: "text", text: tableRows.join('\n') }]
    };
  } catch (error) {
    return {
      isError: true,
      content: [{ type: "text", text: `Error analyzing directory: ${error}` }]
    };
  }
}

export const handlers = {
  [ToolName.TYPESCRIPT_ANALYZE_TEXT]: handleAnalyzeText,
  [ToolName.TYPESCRIPT_ANALYZE_FILE]: handleAnalyzeFile,
  [ToolName.TYPESCRIPT_ANALYZE_DIRECTORY]: handleAnalyzeDirectory
};