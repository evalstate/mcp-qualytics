import { parse, AST_NODE_TYPES, TSESTree } from "@typescript-eslint/typescript-estree";
import type { FileAnalysis, CodeMetrics } from "../types/metrics.js";
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

    // Get name for class or interface
    const getTypeIdentifier = (node: TSESTree.Node): string | undefined => {
      if ((node.type === AST_NODE_TYPES.ClassDeclaration || 
           node.type === AST_NODE_TYPES.ClassExpression || 
           node.type === AST_NODE_TYPES.TSInterfaceDeclaration) && 
          node.id) {
        return node.id.name;
      }
      return undefined;
    };

    // Get superclass for classes
    const getSuperclassIdentifier = (node: TSESTree.Node): string | undefined => {
      if ((node.type === AST_NODE_TYPES.ClassDeclaration || 
           node.type === AST_NODE_TYPES.ClassExpression) && 
          node.superClass && 
          node.superClass.type === AST_NODE_TYPES.Identifier) {
        return node.superClass.name;
      }
      return undefined;
    };

    // Get extended interfaces
    const getExtendedInterfaces = (node: TSESTree.Node): string[] => {
      if (node.type === AST_NODE_TYPES.TSInterfaceDeclaration && node.extends) {
        return node.extends
          .map(ext => ext.expression)
          .filter((exp): exp is TSESTree.Identifier => exp.type === AST_NODE_TYPES.Identifier)
          .map(id => id.name);
      }
      return [];
    };

    // Get implemented interfaces for classes
    const getImplementedInterfaces = (node: TSESTree.Node): string[] => {
      if ((node.type === AST_NODE_TYPES.ClassDeclaration || 
           node.type === AST_NODE_TYPES.ClassExpression) && 
          node.implements) {
        return node.implements
          .map(impl => impl.expression)
          .filter((exp): exp is TSESTree.Identifier => exp.type === AST_NODE_TYPES.Identifier)
          .map(id => id.name);
      }
      return [];
    };

    // First pass: collect all type names and their inheritance relationships
    const inheritanceEdges: [string, string][] = [];
    
    this.traverse(ast, node => {
      const typeName = getTypeIdentifier(node);
      
      if (!typeName) return;

      // Initialize base depth
      inheritanceMap.set(typeName, 1);

      // Add class inheritance edges
      const superClassName = getSuperclassIdentifier(node);
      if (superClassName) {
        inheritanceEdges.push([typeName, superClassName]);
      }

      // Add interface extension edges
      const extendedInterfaces = getExtendedInterfaces(node);
      for (const interfaceName of extendedInterfaces) {
        inheritanceEdges.push([typeName, interfaceName]);
      }

      // Add interface implementation edges
      const implementedInterfaces = getImplementedInterfaces(node);
      for (const interfaceName of implementedInterfaces) {
        inheritanceEdges.push([typeName, interfaceName]);
      }
    });

    // Second pass: calculate inheritance depths using fixed-point iteration
    let changed: boolean;
    do {
      changed = false;
      for (const [childName, parentName] of inheritanceEdges) {
        const parentDepth = inheritanceMap.get(parentName) || 1;
        const currentDepth = inheritanceMap.get(childName) || 1;
        const newDepth = parentDepth + 1;
        
        if (newDepth > currentDepth) {
          inheritanceMap.set(childName, newDepth);
          changed = true;
        }
      }
    } while (changed);

    // Return maximum depth found
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