import { promises as fs } from 'fs';
import path from 'path';
import ignore from 'ignore';

/**
 * Recursively finds TypeScript files in a directory while respecting ignore patterns
 */
export async function findTypeScriptFiles(dir: string, additionalIgnorePatterns: string[] = []): Promise<string[]> {
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

/**
 * Formats analysis results as a markdown table
 */
export function formatAnalysisTable(analysis: any, filename?: string) {
  let tableRows = [
    '| Scope | Name | Type | Lines | LOC | Complexity | Maintainability | Classes | Methods | Avg Complexity | Inheritance Depth |',
    '|--------|------|------|-------|-----|------------|----------------|----------|----------|----------------|------------------|',
    // File level metrics
    `| file | ${filename || 'input'} | - | - | ${analysis.fileMetrics.linesOfCode} | ${analysis.fileMetrics.cyclomaticComplexity} | ${analysis.fileMetrics.maintainabilityIndex.toFixed(2)} | ${analysis.fileMetrics.classCount} | ${analysis.fileMetrics.methodCount} | ${analysis.fileMetrics.averageMethodComplexity.toFixed(2)} | ${analysis.fileMetrics.depthOfInheritance} |`
  ];
  
  // Function level metrics
  for (const fn of analysis.functions) {
    tableRows.push(
      `| function | ${fn.name} | ${fn.type} | ${fn.startLine}-${fn.endLine} | ${fn.metrics.linesOfCode} | ${fn.metrics.cyclomaticComplexity} | ${fn.metrics.maintainabilityIndex.toFixed(2)} | - | ${fn.metrics.methodCount} | ${fn.metrics.averageMethodComplexity.toFixed(2)} | - |`
    );
  }
  
  return tableRows.join('\n');
}

/**
 * Formats analysis results as human-readable text
 */
export function formatAnalysisText(analysis: any, filename?: string) {
  const fileText = `${filename ? `File: ${filename}\n` : ''}Metrics:
- Lines of Code: ${analysis.fileMetrics.linesOfCode}
- Cyclomatic Complexity: ${analysis.fileMetrics.cyclomaticComplexity}
- Maintainability Index: ${analysis.fileMetrics.maintainabilityIndex.toFixed(2)}
- Class Count: ${analysis.fileMetrics.classCount}
- Method Count: ${analysis.fileMetrics.methodCount}
- Average Method Complexity: ${analysis.fileMetrics.averageMethodComplexity.toFixed(2)}
- Depth of Inheritance: ${analysis.fileMetrics.depthOfInheritance}

Functions:`;

  const functionsText = analysis.functions
    .map((fn: any) => `
  ${fn.name} (${fn.type})
  Lines: ${fn.startLine}-${fn.endLine}
  - Lines of Code: ${fn.metrics.linesOfCode}
  - Cyclomatic Complexity: ${fn.metrics.cyclomaticComplexity}
  - Maintainability Index: ${fn.metrics.maintainabilityIndex.toFixed(2)}
  - Methods: ${fn.metrics.methodCount}
  - Average Method Complexity: ${fn.metrics.averageMethodComplexity.toFixed(2)}`
    ).join('\n');

  return `${fileText}${functionsText}`;
}