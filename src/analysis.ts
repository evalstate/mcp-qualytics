import { analyzeFile as internalAnalyzeFile, calculateMetrics } from './metrics/index.js';
import type { FileAnalysis, CodeMetrics } from './types.js';

/**
 * Performs a detailed code quality analysis of a single TypeScript file.
 */
export function typescriptAnalyzeFile(code: string, filepath: string): FileAnalysis {
  return internalAnalyzeFile(code, filepath);
}

/**
 * Calculates metrics for a TypeScript file.
 */
export function typescriptCalculateMetrics(code: string, filepath: string): CodeMetrics {
  return calculateMetrics(code, filepath);
}