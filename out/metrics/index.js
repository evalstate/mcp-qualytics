import { parse, AST_NODE_TYPES } from "@typescript-eslint/typescript-estree";
import { functionAnalyzer } from "./function-analyzer.js";
import { halsteadMetricsCalculator } from "./halstead.js";
import { cyclomaticComplexityCalculator } from "./complexity.js";
import { calculateMaintainabilityIndex } from "./maintainability.js";
const DEFAULT_PARSE_OPTIONS = {
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
    analyzeFile(code, filePath) {
        try {
            const ast = this.parseTypeScript(code);
            const functions = functionAnalyzer.analyzeFunctions(ast);
            const fileMetrics = this.calculateFileMetrics(ast, functions.length);
            return {
                fileMetrics,
                functions: functions.map(f => ({
                    name: f.name,
                    type: f.type,
                    startLine: f.startLine,
                    endLine: f.endLine,
                    metrics: f.metrics.metrics
                })),
            };
        }
        catch (error) {
            console.error(`Failed to parse ${filePath}:`, error);
            return this.createEmptyAnalysis();
        }
    }
    parseTypeScript(code) {
        return parse(code, DEFAULT_PARSE_OPTIONS);
    }
    calculateFileMetrics(ast, methodCount) {
        const halsteadVolume = halsteadMetricsCalculator.process(ast);
        const complexity = cyclomaticComplexityCalculator.process(ast);
        const loc = this.countLogicalLinesOfCode(ast);
        const maintainabilityIndex = calculateMaintainabilityIndex(halsteadVolume, complexity, loc);
        const classCount = this.countClasses(ast);
        const averageMethodComplexity = methodCount > 0 ? complexity / methodCount : 0;
        const depthOfInheritance = this.calculateInheritanceDepth(ast);
        return {
            linesOfCode: loc,
            cyclomaticComplexity: complexity,
            maintainabilityIndex,
            classCount,
            methodCount,
            averageMethodComplexity,
            depthOfInheritance,
        };
    }
    countLogicalLinesOfCode(ast) {
        let count = 0;
        this.traverse(ast, node => {
            if (this.isExecutableNode(node)) {
                count++;
            }
        });
        return count;
    }
    countClasses(ast) {
        let count = 0;
        this.traverse(ast, node => {
            if (node.type === AST_NODE_TYPES.ClassDeclaration) {
                count++;
            }
        });
        return count;
    }
    calculateInheritanceDepth(ast) {
        const inheritanceMap = new Map();
        this.traverse(ast, node => {
            if (node.type === AST_NODE_TYPES.ClassDeclaration && node.id) {
                let depth = 1;
                if (node.superClass && node.superClass.type === AST_NODE_TYPES.Identifier) {
                    depth = (inheritanceMap.get(node.superClass.name) || 1) + 1;
                }
                inheritanceMap.set(node.id.name, depth);
            }
        });
        return inheritanceMap.size > 0 ? Math.max(...inheritanceMap.values()) : 0;
    }
    traverse(node, callback) {
        callback(node);
        for (const key in node) {
            const child = node[key];
            if (child && typeof child === 'object') {
                if (Array.isArray(child)) {
                    child.forEach(item => {
                        if (item && typeof item === 'object' && 'type' in item) {
                            this.traverse(item, callback);
                        }
                    });
                }
                else if ('type' in child) {
                    this.traverse(child, callback);
                }
            }
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
    createEmptyAnalysis() {
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
export function analyzeFile(code, filePath) {
    return fileMetricsAnalyzer.analyzeFile(code, filePath);
}
export function calculateMetrics(code, filePath) {
    const analysis = analyzeFile(code, filePath);
    return analysis.fileMetrics;
}
