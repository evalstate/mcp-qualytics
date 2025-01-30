import { AST_NODE_TYPES, TSESTree } from "@typescript-eslint/typescript-estree";
import { isFunctionLike } from "../types/nodes.js";
import { MetricsCalculator, MetricsResult } from "../types/metrics.js";
import { halsteadMetricsCalculator } from "./halstead.js";
import { cyclomaticComplexityCalculator } from "./complexity.js";
import { calculateMaintainabilityIndex } from "./maintainability.js";

type FunctionType = "function" | "method" | "arrow";

interface FunctionAnalysis {
  name: string;
  type: FunctionType;
  startLine: number;
  endLine: number;
  metrics: MetricsResult;
}

export class FunctionAnalyzer implements MetricsCalculator<TSESTree.Node> {
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
        lloc: loc,
      },
    };
  }

  analyzeFunctions(ast: TSESTree.Node): FunctionAnalysis[] {
    const functions: FunctionAnalysis[] = [];
    const processedNodes = new Set<TSESTree.Node>();

    const processFunction = (node: TSESTree.Node) => {
      if (!node.loc || processedNodes.has(node)) {
        return;
      }

      // For method definitions, we want to analyze the function value
      if (node.type === AST_NODE_TYPES.MethodDefinition) {
        const methodNode = node as TSESTree.MethodDefinition;
        processedNodes.add(methodNode);
        processedNodes.add(methodNode.value);

        const analysis: FunctionAnalysis = {
          name: this.getFunctionName(methodNode),
          type: "method",
          startLine: methodNode.loc.start.line,
          endLine: methodNode.loc.end.line,
          metrics: this.calculate(methodNode.value),
        };
        functions.push(analysis);
        return;
      }

      // Handle other function-like nodes
      if (isFunctionLike(node)) {
        processedNodes.add(node);
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

    this.traverseAST(ast, processFunction);
    return functions.sort((a, b) => a.startLine - b.startLine);
  }

  private traverseAST(
    node: TSESTree.Node,
    callback: (node: TSESTree.Node) => void
  ): void {
    callback(node);

    for (const key in node) {
      const child = (node as any)[key];
      if (child && typeof child === "object") {
        if (Array.isArray(child)) {
          child.forEach((item) => {
            if (item && typeof item === "object" && "type" in item) {
              this.traverseAST(item as TSESTree.Node, callback);
            }
          });
        } else if ("type" in child) {
          this.traverseAST(child as TSESTree.Node, callback);
        }
      }
    }
  }

  private getFunctionName(node: TSESTree.Node): string {
    switch (node.type) {
      case AST_NODE_TYPES.FunctionDeclaration:
        return (node as TSESTree.FunctionDeclaration).id?.name || "<anonymous>";

      case AST_NODE_TYPES.MethodDefinition:
        const methodNode = node as TSESTree.MethodDefinition;
        return methodNode.key.type === AST_NODE_TYPES.Identifier
          ? methodNode.key.name
          : "<computed>";

      case AST_NODE_TYPES.ArrowFunctionExpression:
      case AST_NODE_TYPES.FunctionExpression:
        // Check for variable declaration parent
        if (
          node.parent?.type === AST_NODE_TYPES.VariableDeclarator &&
          (node.parent as TSESTree.VariableDeclarator).id.type ===
            AST_NODE_TYPES.Identifier
        ) {
          return (
            (node.parent as TSESTree.VariableDeclarator)
              .id as TSESTree.Identifier
          ).name;
        }
        // Check for method definition parent
        if (node.parent?.type === AST_NODE_TYPES.MethodDefinition) {
          const methodParent = node.parent as TSESTree.MethodDefinition;
          return methodParent.key.type === AST_NODE_TYPES.Identifier
            ? methodParent.key.name
            : "<computed>";
        }
        return node.type === AST_NODE_TYPES.ArrowFunctionExpression
          ? "<arrow>"
          : "<anonymous>";

      default:
        return "<unknown>";
    }
  }

  private getFunctionType(node: TSESTree.Node): FunctionType {
    switch (node.type) {
      case AST_NODE_TYPES.FunctionDeclaration:
      case AST_NODE_TYPES.FunctionExpression:
        return "function";
      case AST_NODE_TYPES.MethodDefinition:
        return "method";
      case AST_NODE_TYPES.ArrowFunctionExpression:
        return "arrow";
      default:
        return "function";
    }
  }

  private isExecutableLine(node: TSESTree.Node): boolean {
    // Executable statements and expressions
    const executableTypes = new Set([
      // Standard statements and expressions
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
      AST_NODE_TYPES.CallExpression,
      AST_NODE_TYPES.AssignmentExpression,
      AST_NODE_TYPES.BinaryExpression,
      AST_NODE_TYPES.LogicalExpression,
      AST_NODE_TYPES.ConditionalExpression,
      AST_NODE_TYPES.NewExpression,
      AST_NODE_TYPES.YieldExpression,
      AST_NODE_TYPES.AwaitExpression,
      AST_NODE_TYPES.SpreadElement,
      AST_NODE_TYPES.ArrayExpression,

      // Declarations
      AST_NODE_TYPES.VariableDeclaration,
      AST_NODE_TYPES.FunctionDeclaration,
      AST_NODE_TYPES.ClassDeclaration,
      AST_NODE_TYPES.TSInterfaceDeclaration,
      AST_NODE_TYPES.TSTypeAliasDeclaration,
      AST_NODE_TYPES.TSEnumDeclaration,
      AST_NODE_TYPES.TSModuleDeclaration,
      AST_NODE_TYPES.ExportDefaultDeclaration,
      AST_NODE_TYPES.ExportNamedDeclaration,
      AST_NODE_TYPES.ExportAllDeclaration,
      AST_NODE_TYPES.ImportDeclaration,

      // Class and object members
      AST_NODE_TYPES.MethodDefinition,
      AST_NODE_TYPES.PropertyDefinition,
      AST_NODE_TYPES.TSParameterProperty,
    ]);

    return executableTypes.has(node.type as AST_NODE_TYPES);
  }

  private countLogicalLinesOfCode(node: TSESTree.Node): number {
    let loc = 0;
    const processedNodes = new Set<TSESTree.Node>();

    this.traverseAST(node, (n) => {
      // Skip if we've already processed this node
      if (processedNodes.has(n)) {
        return;
      }
      processedNodes.add(n);

      // Count this node if it's executable
      if (this.isExecutableLine(n)) {
        loc++;
      }
    });

    return loc;
  }

  // Public method for external use
  countLogicalLines(node: TSESTree.Node): number {
    return this.countLogicalLinesOfCode(node);
  }
}

export const functionAnalyzer = new FunctionAnalyzer();
