import { HalsteadMetrics, CodeMetrics } from '../types.js';

export interface MetricsResult {
  metrics: CodeMetrics;
  details?: {
    halstead?: HalsteadMetrics;
    complexity?: number;
    loc?: number;
  };
}

export interface MetricsCalculator<T = unknown> {
  calculate(input: T): MetricsResult;
}

export interface MetricsProcessor {
  process(node: unknown): number;
}