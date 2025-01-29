import { AST_NODE_TYPES, TSESTree } from "@typescript-eslint/typescript-estree";
import { isFunctionLike } from "../types/nodes.js";
import { MetricsCalculator, MetricsResult } from "../types/metrics.js";
import { halsteadMetricsCalculator } from "./halstead.js";
import { cyclomaticComplexityCalculator } from "./complexity.js";
import { calculateMaintainabilityIndex } from "./maintainability.js";

type FunctionType = 'function' | 'method' | 'arrow';

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
        loc,
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
          type: 'method',
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

  private traverseAST(node: TSESTree.Node, callback: (node: TSESTree.Node) => void): void {
    callback(node);

    for (const key in node) {
      const child = (node as any)[key];
      if (child && typeof child === 'object') {
        if (Array.isArray(child)) {
          child.forEach(item => {
            if (item && typeof item === 'object' && 'type' in item) {
              this.traverseAST(item as TSESTree.Node, callback);
            }
          });
        } else if ('type' in child) {
          this.traverseAST(child as TSESTree.Node, callback);
        }
      }
    }
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
        // Check for variable declaration parent
        if (node.parent?.type === AST_NODE_TYPES.VariableDeclarator && 
            (node.parent as TSESTree.VariableDeclarator).id.type === AST_NODE_TYPES.Identifier) {
          return ((node.parent as TSESTree.VariableDeclarator).id as TSESTree.Identifier).name;
        }
        // Check for method definition parent
        if (node.parent?.type === AST_NODE_TYPES.MethodDefinition) {
          const methodParent = node.parent as TSESTree.MethodDefinition;
          return methodParent.key.type === AST_NODE_TYPES.Identifier
            ? methodParent.key.name
            : '<computed>';
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
    // Executable statements
    const executableTypes = new Set([
      // Standard executable statements
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
      
      // Declarations
      AST_NODE_TYPES.VariableDeclaration,
      AST_NODE_TYPES.FunctionDeclaration,
      AST_NODE_TYPES.ClassDeclaration,
      AST_NODE_TYPES.TSInterfaceDeclaration,
      AST_NODE_TYPES.TSTypeAliasDeclaration,
      AST_NODE_TYPES.TSEnumDeclaration,
      
      // Imports/Exports
      AST_NODE_TYPES.ImportDeclaration,
      AST_NODE_TYPES.ExportDefaultDeclaration,
      AST_NODE_TYPES.ExportNamedDeclaration,
      
      // Class features
      AST_NODE_TYPES.PropertyDefinition,
      AST_NODE_TYPES.TSParameterProperty,
    ]);

    return executableTypes.has(node.type as AST_NODE_TYPES);
  }

  private countLogicalLinesOfCode(node: TSESTree.Node): number {
    let loc = 0;
    const processedNodes = new Set<TSESTree.Node>();

    const countBlockStatements = (blockNode: TSESTree.BlockStatement): number => {
        let count = 0;
        for (const statement of blockNode.body) {
            if (this.isExecutableNode(statement)) {
                count++;
            }
        }
        return count;
    };

    this.traverseAST(node, (n) => {
        // Skip if we've already processed this node
        if (processedNodes.has(n)) {
            return;
        }

        // Mark as processed
        processedNodes.add(n);

        // Handle different node types
        switch (n.type) {
            case AST_NODE_TYPES.VariableDeclaration:
                // Count the declaration itself
                loc++;
                break;

            case AST_NODE_TYPES.MethodDefinition:
                const methodNode = n as TSESTree.MethodDefinition;
                // Count the method declaration
                loc++;
                
                // For constructors, count parameter properties
                if (methodNode.kind === 'constructor') {
                    const params = (methodNode.value as TSESTree.FunctionExpression).params;
                    const paramProps = params.filter(p => p.type === AST_NODE_TYPES.TSParameterProperty);
                    loc += paramProps.length;
                }

                // Count block statements if present
                if (methodNode.value.body && methodNode.value.body.type === AST_NODE_TYPES.BlockStatement) {
                    loc += countBlockStatements(methodNode.value.body);
                }
                break;

            case AST_NODE_TYPES.FunctionDeclaration:
            case AST_NODE_TYPES.FunctionExpression:
                const funcNode = n as TSESTree.FunctionDeclaration | TSESTree.FunctionExpression;
                // Count the function declaration
                loc++;
                
                // Count block statements
                if (funcNode.body.type === AST_NODE_TYPES.BlockStatement) {
                    loc += countBlockStatements(funcNode.body);
                }
                break;

            case AST_NODE_TYPES.ArrowFunctionExpression:
                const arrowNode = n as TSESTree.ArrowFunctionExpression;
                // Count the arrow function itself
                loc++;
                
                // For arrow functions with expression bodies, count the expression
                if (arrowNode.body.type !== AST_NODE_TYPES.BlockStatement) {
                    loc++;
                } else {
                    // Count block statements for block bodies
                    loc += countBlockStatements(arrowNode.body);
                }
                break;

            default:
                // Handle other executable nodes
                if (this.isExecutableNode(n)) {
                    loc++;
                }
                break;
        }
    });

    return loc;
  }
}

export const functionAnalyzer = new FunctionAnalyzer();