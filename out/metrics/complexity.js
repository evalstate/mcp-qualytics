import { AST_NODE_TYPES } from "@typescript-eslint/typescript-estree";
import { traverseAST } from "../ast-utils.js";
class CyclomaticComplexityCalculator {
    static CONTROL_FLOW_NODES = new Set([
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
    static LOGICAL_OPERATORS = new Set(["&&", "||", "??"]);
    process(ast) {
        let complexity = 1; // Base complexity
        traverseAST(ast, (node) => {
            if (this.isComplexityIncreasingNode(node)) {
                complexity++;
            }
        });
        return complexity;
    }
    isComplexityIncreasingNode(node) {
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
    isSwitchCase(node) {
        return node.type === AST_NODE_TYPES.SwitchCase &&
            node.test !== null;
    }
    isLogicalExpression(node) {
        return node.type === AST_NODE_TYPES.LogicalExpression &&
            CyclomaticComplexityCalculator.LOGICAL_OPERATORS.has(node.operator);
    }
}
export const cyclomaticComplexityCalculator = new CyclomaticComplexityCalculator();
