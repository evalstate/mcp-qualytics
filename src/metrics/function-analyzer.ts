import { AST_NODE_TYPES, TSESTree } from "@typescript-eslint/typescript-estree";
import { isFunctionLike } from "../types/nodes";
import { MetricsCalculator, MetricsResult } from "../types/metrics";
import { halsteadMetricsCalculator } from "./halstead";
import { cyclomaticComplexityCalculator } from "./complexity";
import { calculateMaintainabilityIndex } from "./maintainability";

type FunctionType = 'function' | 'method' | 'arrow';

interface FunctionAnalysis {
  name: string;
  type: FunctionType;
  startLine: number;
  endLine: number;
  metrics: MetricsResult;
}

class FunctionAnalyzer implements MetricsCalculator<TSESTree.Node> {
  calculate(node: TSESTree.Node): MetricsResult {
    const halsteadVolume = halsteadMetricsCalculator.process(node);
    const complexity = cyclomaticComplexityCalculator.process(node);
    const loc = this.countLogicalLinesOfCode(node);
    const maintainabilityIndex = calculateMaintainabilityIndex(
      halsteadVolume,
      complexity,
      loc
    );

    return {
      metrics: {
        linesOfCode: loc,
        cyclomaticComplexity: complexity,
        maintainabilityIndex,
        averageMethodComplexity: complexity,
        methodCount: 1,
        classCount: 0,
        depthOfInheritance: 0,
      },
      details: {
        halstead: { volume: halsteadVolume },
        complexity,
        loc,
      },
    };
  }

  analyzeFunctions(ast: TSESTree.Node): FunctionAnalysis[] {
    const functions: FunctionAnalysis[] = [];

    const processFunction = (node: TSESTree.Node) => {
      if (isFunctionLike(node) && node.loc) {
        const analysis: FunctionAnalysis = {
          name: this.getFunctionName(node),
          type: this.getFunctionType(node),
          startLine: node.loc.start.line,
          endLine: node.loc.end.line,
          metrics: this.calculate(node),
        };

        functions.push(analysis);
      }
    };

    this.traverseFunctions(ast, processFunction);
    return functions.sort((a, b) => a.startLine - b.startLine);
  }

  private traverseFunctions(ast: TSESTree.Node, callback: (node: TSESTree.Node) => void): void {
    const visit = (node: TSESTree.Node) => {
      if (node.type === AST_NODE_TYPES.MethodDefinition) {
        callback((node as TSESTree.MethodDefinition).value);
      } else {
        callback(node);
      }

      for (const key in node) {
        const child = (node as any)[key];
        if (child && typeof child === 'object') {
          if (Array.isArray(child)) {
            child.forEach(item => {
              if (item && typeof item === 'object' && 'type' in item) {
                visit(item as TSESTree.Node);
              }
            });
          } else if ('type' in child) {
            visit(child as TSESTree.Node);
          }
        }
      }
    };

    visit(ast);
  }

  private getFunctionName(node: TSESTree.Node): string {
    switch (node.type) {
      case AST_NODE_TYPES.FunctionDeclaration:
        return (node as TSESTree.FunctionDeclaration).id?.name || '<anonymous>';
      case AST_NODE_TYPES.MethodDefinition:
        const methodNode = node as TSESTree.MethodDefinition;
        return methodNode.key.type === AST_NODE_TYPES.Identifier 
          ? methodNode.key.name 
          : '<computed>';
      case AST_NODE_TYPES.ArrowFunctionExpression:
      case AST_NODE_TYPES.FunctionExpression:
        if (node.parent?.type === AST_NODE_TYPES.VariableDeclarator && 
            (node.parent as TSESTree.VariableDeclarator).id.type === AST_NODE_TYPES.Identifier) {
          return ((node.parent as TSESTree.VariableDeclarator).id as TSESTree.Identifier).name;
        }
        return node.type === AST_NODE_TYPES.ArrowFunctionExpression 
          ? '<arrow>' 
          : '<anonymous>';
      default:
        return '<unknown>';
    }
  }

  private getFunctionType(node: TSESTree.Node): FunctionType {
    switch (node.type) {
      case AST_NODE_TYPES.FunctionDeclaration:
      case AST_NODE_TYPES.FunctionExpression:
        return 'function';
      case AST_NODE_TYPES.MethodDefinition:
        return 'method';
      case AST_NODE_TYPES.ArrowFunctionExpression:
        return 'arrow';
      default:
        return 'function';
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

    return executableTypes.has(node.type as AST_NODE_TYPES);
  }

  private countLogicalLinesOfCode(node: TSESTree.Node): number {
    let loc = 0;
    this.traverseFunctions(node, (n) => {
      if (this.isExecutableNode(n)) {
        loc++;
      }
    });
    return loc;
  }
}

export const functionAnalyzer = new FunctionAnalyzer();