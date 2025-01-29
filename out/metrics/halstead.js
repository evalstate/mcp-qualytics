import { AST_NODE_TYPES } from "@typescript-eslint/typescript-estree";
import { traverseAST } from "../ast-utils.js";
class HalsteadMetricsCalculator {
    operatorMatchers = [
        {
            type: AST_NODE_TYPES.BinaryExpression,
            process: (node) => this.processOperator(node)
        },
        {
            type: AST_NODE_TYPES.LogicalExpression,
            process: (node) => this.processOperator(node)
        },
        {
            type: AST_NODE_TYPES.AssignmentExpression,
            process: (node) => this.processOperator(node)
        },
        {
            type: AST_NODE_TYPES.UpdateExpression,
            process: (node) => this.processOperator(node)
        },
        {
            type: AST_NODE_TYPES.UnaryExpression,
            process: (node) => this.processOperator(node)
        }
    ];
    operandMatchers = [
        {
            type: AST_NODE_TYPES.Identifier,
            process: (node) => this.processIdentifier(node)
        },
        {
            type: AST_NODE_TYPES.Literal,
            process: (node) => this.processLiteral(node)
        },
        {
            type: AST_NODE_TYPES.MemberExpression,
            process: (node) => this.processMemberExpression(node)
        }
    ];
    data = {
        operators: new Set(),
        operands: new Set(),
        operatorCount: 0,
        operandCount: 0
    };
    process(ast) {
        this.resetData();
        this.gatherMetrics(ast);
        return this.calculateVolume();
    }
    resetData() {
        this.data.operators.clear();
        this.data.operands.clear();
        this.data.operatorCount = 0;
        this.data.operandCount = 0;
    }
    gatherMetrics(ast) {
        traverseAST(ast, (node) => {
            const operatorMatcher = this.operatorMatchers.find(m => m.type === node.type);
            const operandMatcher = this.operandMatchers.find(m => m.type === node.type);
            if (operatorMatcher) {
                operatorMatcher.process(node);
            }
            else if (operandMatcher) {
                operandMatcher.process(node);
            }
            else if (node.type === AST_NODE_TYPES.CallExpression) {
                this.processCallExpression(node);
            }
            else if (node.type === AST_NODE_TYPES.ConditionalExpression) {
                this.processConditionalExpression();
            }
            else if (node.type === AST_NODE_TYPES.NewExpression) {
                this.processNewExpression();
            }
        });
    }
    processOperator(node) {
        this.data.operators.add(node.operator);
        this.data.operatorCount++;
    }
    processIdentifier(node) {
        this.data.operands.add(node.name);
        this.data.operandCount++;
    }
    processLiteral(node) {
        this.data.operands.add(String(node.value));
        this.data.operandCount++;
    }
    processMemberExpression(node) {
        if (node.property.type === AST_NODE_TYPES.Identifier) {
            this.data.operands.add(node.property.name);
            this.data.operandCount++;
        }
    }
    processCallExpression(node) {
        if (node.callee.type === AST_NODE_TYPES.Identifier) {
            this.data.operators.add(`${node.callee.name}()`);
            this.data.operatorCount++;
        }
    }
    processConditionalExpression() {
        this.data.operators.add("?:");
        this.data.operatorCount++;
    }
    processNewExpression() {
        this.data.operators.add("new");
        this.data.operatorCount++;
    }
    calculateVolume() {
        const vocabulary = this.data.operators.size + this.data.operands.size;
        const length = this.data.operatorCount + this.data.operandCount;
        return vocabulary > 0 ? length * Math.log2(vocabulary) : 0;
    }
}
export const halsteadMetricsCalculator = new HalsteadMetricsCalculator();
