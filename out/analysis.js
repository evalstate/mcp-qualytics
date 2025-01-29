import { analyzeFile as internalAnalyzeFile, calculateMetrics } from './metrics/index.js';
/**
 * Performs a detailed code quality analysis of a single TypeScript file.
 */
export function typescriptAnalyzeFile(code, filepath) {
    return internalAnalyzeFile(code, filepath);
}
/**
 * Calculates metrics for a TypeScript file.
 */
export function typescriptCalculateMetrics(code, filepath) {
    return calculateMetrics(code, filepath);
}
