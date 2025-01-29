import { AST_NODE_TYPES, TSESTree } from "@typescript-eslint/typescript-estree";
import { MetricsProcessor } from "../types/metrics";
import { traverseAST } from "../ast-utils";

class CyclomaticComplexityCalculator implements MetricsProcessor {
  private static readonly CONTROL_FLOW_NODES = new Set([
    AST_NODE_TYPES.IfStatement,
    AST_NODE_TYPES.ForStatement,
    AST_NODE_TYPES.ForInStatement,
    AST_NODE_TYPES.ForOfStatement,
    AST_NODE_TYPES.WhileStatement,
    AST_NODE_TYPES.DoWhileStatement,
    AST_NODE_TYPES.CatchClause,
    AST_NODE_TYPES.ConditionalExpression,
    AST_NODE_TYPES.TryStatement,
    AST_NODE_TYPES.ThrowStatement
  ]);

  private static readonly LOGICAL_OPERATORS = new Set(["&&", "||", "??"]);

  process(ast: TSESTree.Node): number {
    let complexity = 1; // Base complexity

    traverseAST(ast, (node) => {
      if (this.isComplexityIncreasingNode(node)) {
        complexity++;
      }
    });

    return complexity;
  }

  private isComplexityIncreasingNode(node: TSESTree.Node): boolean {
    if (CyclomaticComplexityCalculator.CONTROL_FLOW_NODES.has(node.type)) {
      return true;
    }

    if (this.isSwitchCase(node)) {
      return true;
    }

    if (this.isLogicalExpression(node)) {
      return true;
    }

    return false;
  }

  private isSwitchCase(node: TSESTree.Node): boolean {
    return node.type === AST_NODE_TYPES.SwitchCase && 
           (node as TSESTree.SwitchCase).test !== null;
  }

  private isLogicalExpression(node: TSESTree.Node): boolean {
    return node.type === AST_NODE_TYPES.LogicalExpression && 
           CyclomaticComplexityCalculator.LOGICAL_OPERATORS.has(
             (node as TSESTree.LogicalExpression).operator
           );
  }
}

export const cyclomaticComplexityCalculator = new CyclomaticComplexityCalculator();