export interface CodeMetrics {
  linesOfCode: number;
  cyclomaticComplexity: number;
  maintainabilityIndex: number;
  depthOfInheritance: number;
  classCount: number;
  methodCount: number;
  averageMethodComplexity: number;
}

export interface HalsteadMetrics {
  volume: number;
}

export interface FunctionInfo {
  name: string;
  type: 'function' | 'method' | 'arrow';
  startLine: number;
  endLine: number;
  metrics: CodeMetrics;
}

export interface FileAnalysis {
  fileMetrics: CodeMetrics;
  functions: FunctionInfo[];
}

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