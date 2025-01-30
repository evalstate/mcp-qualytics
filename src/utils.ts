import { promises as fs } from 'fs';
import path from 'path';
import createIgnore from 'ignore';
import type { AnalysisResult, ColumnConfig, FileMetrics, FunctionMetric } from './types.js';

const DEFAULT_FILE_COLUMNS: ColumnConfig[] = [
  { header: 'Scope', key: 'scope' },
  { header: 'Name', key: 'name' },
  { header: 'Type', key: 'type' },
  { header: 'Lines', key: 'lines' },
  { header: 'LOC', key: 'linesOfCode' },
  { header: 'Complexity', key: 'cyclomaticComplexity' },
  { 
    header: 'Maintainability', 
    key: 'maintainabilityIndex', 
    formatter: (value: unknown) => typeof value === 'number' ? value.toFixed(2) : String(value)
  },
  { header: 'Classes', key: 'classCount' },
  { header: 'Methods', key: 'methodCount' },
  { 
    header: 'Avg Complexity', 
    key: 'averageMethodComplexity', 
    formatter: (value: unknown) => typeof value === 'number' ? value.toFixed(2) : String(value)
  },
  { header: 'Inheritance Depth', key: 'depthOfInheritance' }
];

/**
 * Recursively finds TypeScript files in a directory while respecting ignore patterns
 */
export async function findTypeScriptFiles(dir: string, additionalIgnorePatterns: string[] = []): Promise<string[]> {
  const files: string[] = [];
  
  // Initialize ignore instance
  const ig = createIgnore();
  
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

function formatTableRow(data: Record<string, unknown>, columns: ColumnConfig[]): string {
  return '| ' + columns.map(col => {
    const value = data[col.key];
    if (value === undefined || value === null) return '-';
    return col.formatter ? col.formatter(value) : String(value);
  }).join(' | ') + ' |';
}

function formatTableHeaders(columns: ColumnConfig[]): string[] {
  const headers = '| ' + columns.map(col => col.header).join(' | ') + ' |';
  const separator = '|' + columns.map(() => '--------').join('|') + '|';
  return [headers, separator];
}

/**
 * Creates structured data for file metrics
 */
function createFileMetricsData(metrics: FileMetrics, filename: string): Record<string, unknown> {
  return {
    scope: 'file',
    name: filename || 'input',
    type: '-',
    lines: '-',
    ...metrics
  };
}

/**
 * Creates structured data for function metrics
 */
function createFunctionMetricsData(fn: FunctionMetric): Record<string, unknown> {
  return {
    scope: 'function',
    name: fn.name,
    type: fn.type,
    lines: `${fn.startLine}-${fn.endLine}`,
    ...fn.metrics,
    classCount: '-',
    depthOfInheritance: '-'
  };
}

/**
 * Formats analysis results as a markdown table
 */
export function formatAnalysisTable(analysis: AnalysisResult, filename?: string): string {
  const rows = [
    ...formatTableHeaders(DEFAULT_FILE_COLUMNS),
    formatTableRow(createFileMetricsData(analysis.fileMetrics, filename || 'input'), DEFAULT_FILE_COLUMNS)
  ];

  // Function level metrics
  for (const fn of analysis.functions) {
    rows.push(formatTableRow(createFunctionMetricsData(fn), DEFAULT_FILE_COLUMNS));
  }
  
  return rows.join('\n');
}