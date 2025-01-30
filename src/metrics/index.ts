import { parse, AST_NODE_TYPES, TSESTree } from "@typescript-eslint/typescript-estree";
import { FileAnalysis, CodeMetrics } from "../types/metrics.js";
import { functionAnalyzer } from "./function-analyzer.js";
import { halsteadMetricsCalculator } from "./halstead.js";
import { cyclomaticComplexityCalculator } from "./complexity.js";
import { calculateMaintainabilityIndex } from "./maintainability.js";

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
      
      // Get raw file-level metrics
      const fileComplexity = cyclomaticComplexityCalculator.process(ast);
      const fileHalstead = halsteadMetricsCalculator.process(ast);
      const fileLLOC = functionAnalyzer.countLogicalLines(ast);
      
      const maintainabilityIndex = calculateMaintainabilityIndex(
        fileHalstead,
        fileComplexity,
        fileLLOC
      );

      // Calculate average method complexity from individual functions
      const averageComplexity = functions.length > 0
        ? functions.reduce((sum, fn) => sum + fn.metrics.metrics.cyclomaticComplexity, 0) / functions.length
        : 0;

      return {
        fileMetrics: {
          linesOfCode: fileLLOC,
          cyclomaticComplexity: fileComplexity,
          maintainabilityIndex,
          averageMethodComplexity: averageComplexity,
          methodCount: functions.length,
          classCount: this.countClasses(ast),
          depthOfInheritance: this.calculateInheritanceDepth(ast),
        },
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

  private countClasses(ast: TSESTree.Node): number {
    let count = 0;
    this.traverse(ast, node => {
      if (node.type === AST_NODE_TYPES.ClassDeclaration || 
          node.type === AST_NODE_TYPES.ClassExpression) {
        count++;
      }
    });
    return count;
  }

  private calculateInheritanceDepth(ast: TSESTree.Node): number {
    const inheritanceMap = new Map<string, number>();

    const getClassIdentifier = (node: TSESTree.Node): string | undefined => {
      if (node.type === AST_NODE_TYPES.ClassDeclaration && node.id) {
        return node.id.name;
      } else if (node.type === AST_NODE_TYPES.ClassExpression && node.id) {
        return node.id.name;
      }
      return undefined;
    };

    const getSuperclassIdentifier = (node: TSESTree.Node): string | undefined => {
      if ((node.type === AST_NODE_TYPES.ClassDeclaration || 
           node.type === AST_NODE_TYPES.ClassExpression) && 
          node.superClass && 
          node.superClass.type === AST_NODE_TYPES.Identifier) {
        return node.superClass.name;
      }
      return undefined;
    };

    // First pass: collect all class names and their direct superclasses
    const inheritanceEdges: [string, string][] = [];
    this.traverse(ast, node => {
      const className = getClassIdentifier(node);
      const superClassName = getSuperclassIdentifier(node);
      
      if (className) {
        inheritanceMap.set(className, 1); // Initialize all classes with depth 1
        if (superClassName) {
          inheritanceEdges.push([className, superClassName]);
        }
      }
    });

    // Second pass: calculate inheritance depths
    let changed: boolean;
    do {
      changed = false;
      for (const [className, superClassName] of inheritanceEdges) {
        const superClassDepth = inheritanceMap.get(superClassName) || 1;
        const currentDepth = inheritanceMap.get(className) || 1;
        const newDepth = superClassDepth + 1;
        
        if (newDepth > currentDepth) {
          inheritanceMap.set(className, newDepth);
          changed = true;
        }
      }
    } while (changed);

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