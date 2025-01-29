import { AST_NODE_TYPES, TSESTree } from "@typescript-eslint/typescript-estree";
import { NodeMatcher, NodeProcessor, TypedNode } from "../types/nodes";
import { MetricsProcessor } from "../types/metrics";
import { traverseAST } from "../ast-utils";

interface HalsteadData {
  operators: Set<string>;
  operands: Set<string>;
  operatorCount: number;
  operandCount: number;
}

type OperatorNode = 
  | TSESTree.BinaryExpression 
  | TSESTree.LogicalExpression 
  | TSESTree.AssignmentExpression 
  | TSESTree.UpdateExpression 
  | TSESTree.UnaryExpression;

class HalsteadMetricsCalculator implements MetricsProcessor {
  private readonly operatorMatchers: Array<NodeMatcher<void>> = [
    {
      type: AST_NODE_TYPES.BinaryExpression,
      process: (node: TSESTree.Node) => this.processOperator(node as OperatorNode)
    },
    {
      type: AST_NODE_TYPES.LogicalExpression,
      process: (node: TSESTree.Node) => this.processOperator(node as OperatorNode)
    },
    {
      type: AST_NODE_TYPES.AssignmentExpression,
      process: (node: TSESTree.Node) => this.processOperator(node as OperatorNode)
    },
    {
      type: AST_NODE_TYPES.UpdateExpression,
      process: (node: TSESTree.Node) => this.processOperator(node as OperatorNode)
    },
    {
      type: AST_NODE_TYPES.UnaryExpression,
      process: (node: TSESTree.Node) => this.processOperator(node as OperatorNode)
    }
  ];

  private readonly operandMatchers: Array<NodeMatcher<void>> = [
    {
      type: AST_NODE_TYPES.Identifier,
      process: (node: TSESTree.Node) => this.processIdentifier(node as TSESTree.Identifier)
    },
    {
      type: AST_NODE_TYPES.Literal,
      process: (node: TSESTree.Node) => this.processLiteral(node as TSESTree.Literal)
    },
    {
      type: AST_NODE_TYPES.MemberExpression,
      process: (node: TSESTree.Node) => this.processMemberExpression(node as TSESTree.MemberExpression)
    }
  ];

  private readonly data: HalsteadData = {
    operators: new Set<string>(),
    operands: new Set<string>(),
    operatorCount: 0,
    operandCount: 0
  };

  process(ast: TSESTree.Node): number {
    this.resetData();
    this.gatherMetrics(ast);
    return this.calculateVolume();
  }

  private resetData(): void {
    this.data.operators.clear();
    this.data.operands.clear();
    this.data.operatorCount = 0;
    this.data.operandCount = 0;
  }

  private gatherMetrics(ast: TSESTree.Node): void {
    traverseAST(ast, (node) => {
      const operatorMatcher = this.operatorMatchers.find(m => m.type === node.type);
      const operandMatcher = this.operandMatchers.find(m => m.type === node.type);

      if (operatorMatcher) {
        operatorMatcher.process(node);
      } else if (operandMatcher) {
        operandMatcher.process(node);
      } else if (node.type === AST_NODE_TYPES.CallExpression) {
        this.processCallExpression(node as TSESTree.CallExpression);
      } else if (node.type === AST_NODE_TYPES.ConditionalExpression) {
        this.processConditionalExpression();
      } else if (node.type === AST_NODE_TYPES.NewExpression) {
        this.processNewExpression();
      }
    });
  }

  private processOperator(node: OperatorNode): void {
    this.data.operators.add(node.operator);
    this.data.operatorCount++;
  }

  private processIdentifier(node: TSESTree.Identifier): void {
    this.data.operands.add(node.name);
    this.data.operandCount++;
  }

  private processLiteral(node: TSESTree.Literal): void {
    this.data.operands.add(String(node.value));
    this.data.operandCount++;
  }

  private processMemberExpression(node: TSESTree.MemberExpression): void {
    if (node.property.type === AST_NODE_TYPES.Identifier) {
      this.data.operands.add((node.property as TSESTree.Identifier).name);
      this.data.operandCount++;
    }
  }

  private processCallExpression(node: TSESTree.CallExpression): void {
    if (node.callee.type === AST_NODE_TYPES.Identifier) {
      this.data.operators.add(`${node.callee.name}()`);
      this.data.operatorCount++;
    }
  }

  private processConditionalExpression(): void {
    this.data.operators.add("?:");
    this.data.operatorCount++;
  }

  private processNewExpression(): void {
    this.data.operators.add("new");
    this.data.operatorCount++;
  }

  private calculateVolume(): number {
    const vocabulary = this.data.operators.size + this.data.operands.size;
    const length = this.data.operatorCount + this.data.operandCount;
    return vocabulary > 0 ? length * Math.log2(vocabulary) : 0;
  }
}

export const halsteadMetricsCalculator = new HalsteadMetricsCalculator();