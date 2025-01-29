import { parse, AST_NODE_TYPES, TSESTree } from "@typescript-eslint/typescript-estree";
import { FileAnalysis, CodeMetrics } from "../types";
import { functionAnalyzer } from "./function-analyzer";
import { halsteadMetricsCalculator } from "./halstead";
import { cyclomaticComplexityCalculator } from "./complexity";
import { calculateMaintainabilityIndex } from "./maintainability";

interface ParseOptions {
  loc: boolean;
  range: boolean;
  comment: boolean;
  tokens: boolean;
  sourceType: "module";
  ecmaFeatures: {
    jsx: boolean;
  };
}

const DEFAULT_PARSE_OPTIONS: ParseOptions = {
  loc: true,
  range: true,
  comment: true,
  tokens: true,
  sourceType: "module",
  ecmaFeatures: {
    jsx: true,
  },
};

class FileMetricsAnalyzer {
  analyzeFile(code: string, filePath: string): FileAnalysis {
    try {
      const ast = this.parseTypeScript(code);
      const functions = functionAnalyzer.analyzeFunctions(ast);
      const fileMetrics = this.calculateFileMetrics(ast, functions.length);

      return {
        fileMetrics,
        functions: functions.map(f => ({
          name: f.name,
          type: f.type,
          startLine: f.startLine,
          endLine: f.endLine,
          metrics: f.metrics.metrics
        })),
      };
    } catch (error) {
      console.error(`Failed to parse ${filePath}:`, error);
      return this.createEmptyAnalysis();
    }
  }

  private parseTypeScript(code: string): TSESTree.Program {
    return parse(code, DEFAULT_PARSE_OPTIONS);
  }

  private calculateFileMetrics(ast: TSESTree.Node, methodCount: number): CodeMetrics {
    const halsteadVolume = halsteadMetricsCalculator.process(ast);
    const complexity = cyclomaticComplexityCalculator.process(ast);
    const loc = this.countLogicalLinesOfCode(ast);
    const maintainabilityIndex = calculateMaintainabilityIndex(
      halsteadVolume,
      complexity,
      loc
    );

    const classCount = this.countClasses(ast);
    const averageMethodComplexity = methodCount > 0 ? complexity / methodCount : 0;
    const depthOfInheritance = this.calculateInheritanceDepth(ast);

    return {
      linesOfCode: loc,
      cyclomaticComplexity: complexity,
      maintainabilityIndex,
      classCount,
      methodCount,
      averageMethodComplexity,
      depthOfInheritance,
    };
  }

  private countLogicalLinesOfCode(ast: TSESTree.Node): number {
    let count = 0;
    this.traverse(ast, node => {
      if (this.isExecutableNode(node)) {
        count++;
      }
    });
    return count;
  }

  private countClasses(ast: TSESTree.Node): number {
    let count = 0;
    this.traverse(ast, node => {
      if (node.type === AST_NODE_TYPES.ClassDeclaration) {
        count++;
      }
    });
    return count;
  }

  private calculateInheritanceDepth(ast: TSESTree.Node): number {
    const inheritanceMap = new Map<string, number>();

    this.traverse(ast, node => {
      if (node.type === AST_NODE_TYPES.ClassDeclaration && node.id) {
        let depth = 1;
        if (node.superClass && node.superClass.type === AST_NODE_TYPES.Identifier) {
          depth = (inheritanceMap.get(node.superClass.name) || 1) + 1;
        }
        inheritanceMap.set(node.id.name, depth);
      }
    });

    return inheritanceMap.size > 0 ? Math.max(...inheritanceMap.values()) : 0;
  }

  private traverse(node: TSESTree.Node, callback: (node: TSESTree.Node) => void): void {
    callback(node);
    for (const key in node) {
      const child = (node as any)[key];
      if (child && typeof child === 'object') {
        if (Array.isArray(child)) {
          child.forEach(item => {
            if (item && typeof item === 'object' && 'type' in item) {
              this.traverse(item, callback);
            }
          });
        } else if ('type' in child) {
          this.traverse(child, callback);
        }
      }
    }
  }

  private isExecutableNode(node: TSESTree.Node): boolean {
    const executableTypes = new Set([
      AST_NODE_TYPES.ExpressionStatement,
      AST_NODE_TYPES.ReturnStatement,
      AST_NODE_TYPES.ThrowStatement,
      AST_NODE_TYPES.BreakStatement,
      AST_NODE_TYPES.ContinueStatement,
      AST_NODE_TYPES.DebuggerStatement,
      AST_NODE_TYPES.DoWhileStatement,
      AST_NODE_TYPES.ForStatement,
      AST_NODE_TYPES.ForInStatement,
      AST_NODE_TYPES.ForOfStatement,
      AST_NODE_TYPES.IfStatement,
      AST_NODE_TYPES.SwitchCase,
      AST_NODE_TYPES.SwitchStatement,
      AST_NODE_TYPES.TryStatement,
      AST_NODE_TYPES.WhileStatement,
      AST_NODE_TYPES.WithStatement,
      AST_NODE_TYPES.VariableDeclaration,
    ]);

    return executableTypes.has(node.type);
  }

  private createEmptyAnalysis(): FileAnalysis {
    return {
      fileMetrics: {
        linesOfCode: 0,
        cyclomaticComplexity: 0,
        maintainabilityIndex: 0,
        classCount: 0,
        methodCount: 0,
        averageMethodComplexity: 0,
        depthOfInheritance: 0,
      },
      functions: [],
    };
  }
}

export const fileMetricsAnalyzer = new FileMetricsAnalyzer();

export function analyzeFile(code: string, filePath: string): FileAnalysis {
  return fileMetricsAnalyzer.analyzeFile(code, filePath);
}

export function calculateMetrics(code: string, filePath: string): CodeMetrics {
  const analysis = analyzeFile(code, filePath);
  return analysis.fileMetrics;
}