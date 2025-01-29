import { AST_NODE_TYPES } from "@typescript-eslint/typescript-estree";
import { isFunctionLike } from "../types/nodes.js";
import { halsteadMetricsCalculator } from "./halstead.js";
import { cyclomaticComplexityCalculator } from "./complexity.js";
import { calculateMaintainabilityIndex } from "./maintainability.js";
class FunctionAnalyzer {
    calculate(node) {
        const halsteadVolume = halsteadMetricsCalculator.process(node);
        const complexity = cyclomaticComplexityCalculator.process(node);
        const loc = this.countLogicalLinesOfCode(node);
        const maintainabilityIndex = calculateMaintainabilityIndex(halsteadVolume, complexity, loc);
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
    analyzeFunctions(ast) {
        const functions = [];
        const processFunction = (node) => {
            if (isFunctionLike(node) && node.loc) {
                const analysis = {
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
    traverseFunctions(ast, callback) {
        const visit = (node) => {
            if (node.type === AST_NODE_TYPES.MethodDefinition) {
                callback(node.value);
            }
            else {
                callback(node);
            }
            for (const key in node) {
                const child = node[key];
                if (child && typeof child === 'object') {
                    if (Array.isArray(child)) {
                        child.forEach(item => {
                            if (item && typeof item === 'object' && 'type' in item) {
                                visit(item);
                            }
                        });
                    }
                    else if ('type' in child) {
                        visit(child);
                    }
                }
            }
        };
        visit(ast);
    }
    getFunctionName(node) {
        switch (node.type) {
            case AST_NODE_TYPES.FunctionDeclaration:
                return node.id?.name || '<anonymous>';
            case AST_NODE_TYPES.MethodDefinition:
                const methodNode = node;
                return methodNode.key.type === AST_NODE_TYPES.Identifier
                    ? methodNode.key.name
                    : '<computed>';
            case AST_NODE_TYPES.ArrowFunctionExpression:
            case AST_NODE_TYPES.FunctionExpression:
                if (node.parent?.type === AST_NODE_TYPES.VariableDeclarator &&
                    node.parent.id.type === AST_NODE_TYPES.Identifier) {
                    return node.parent.id.name;
                }
                return node.type === AST_NODE_TYPES.ArrowFunctionExpression
                    ? '<arrow>'
                    : '<anonymous>';
            default:
                return '<unknown>';
        }
    }
    getFunctionType(node) {
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
    isExecutableNode(node) {
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
    countLogicalLinesOfCode(node) {
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
