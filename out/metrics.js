import { AST_NODE_TYPES, parse, } from "@typescript-eslint/typescript-estree";
import { isExecutableNode, traverseAST } from "./ast-utils.js";
function calculateMetricsForNode(node) {
    const linesOfCode = countLogicalLinesOfCode(node);
    const cyclomaticComplexity = calculateCyclomaticComplexity(node);
    const halsteadMetrics = calculateHalsteadMetrics(node);
    const maintainabilityIndex = calculateMaintainabilityIndex(halsteadMetrics.volume, cyclomaticComplexity, linesOfCode);
    const classStructure = analyzeClassStructure(node);
    const functionMetrics = analyzeFunctionStructure(node);
    const averageMethodComplexity = functionMetrics.functionCount > 0
        ? cyclomaticComplexity / functionMetrics.functionCount
        : 0;
    return {
        linesOfCode: isFinite(linesOfCode) ? linesOfCode : 0,
        cyclomaticComplexity: isFinite(cyclomaticComplexity)
            ? cyclomaticComplexity
            : 0,
        maintainabilityIndex: isFinite(maintainabilityIndex)
            ? maintainabilityIndex
            : 0,
        depthOfInheritance: isFinite(classStructure.maxInheritanceDepth)
            ? classStructure.maxInheritanceDepth
            : 0,
        classCount: isFinite(classStructure.classCount)
            ? classStructure.classCount
            : 0,
        methodCount: isFinite(functionMetrics.functionCount)
            ? functionMetrics.functionCount
            : 0,
        averageMethodComplexity: isFinite(averageMethodComplexity)
            ? averageMethodComplexity
            : 0,
    };
}
const functionNameExtractors = {
    [AST_NODE_TYPES.FunctionDeclaration]: (node) => node.id?.name || '<anonymous>',
    [AST_NODE_TYPES.MethodDefinition]: (node) => {
        const methodNode = node;
        return methodNode.key.type === AST_NODE_TYPES.Identifier ? methodNode.key.name : '<computed>';
    },
    [AST_NODE_TYPES.ArrowFunctionExpression]: (node) => {
        const parent = node.parent;
        if (parent?.type === AST_NODE_TYPES.VariableDeclarator &&
            parent.id.type === AST_NODE_TYPES.Identifier) {
            return parent.id.name;
        }
        return '<arrow>';
    },
    [AST_NODE_TYPES.FunctionExpression]: (node) => {
        const parent = node.parent;
        if (parent?.type === AST_NODE_TYPES.VariableDeclarator &&
            parent.id.type === AST_NODE_TYPES.Identifier) {
            return parent.id.name;
        }
        return '<anonymous>';
    }
};
function getFunctionName(node) {
    const extractor = functionNameExtractors[node.type];
    return extractor ? extractor(node) : '<unknown>';
}
function getFunctionType(node) {
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
function parseTypeScript(code) {
    return parse(code, DEFAULT_PARSE_OPTIONS);
}
function isAnalyzableFunction(node) {
    return (node.type === AST_NODE_TYPES.FunctionDeclaration ||
        node.type === AST_NODE_TYPES.FunctionExpression ||
        node.type === AST_NODE_TYPES.ArrowFunctionExpression ||
        node.type === AST_NODE_TYPES.MethodDefinition);
}
function analyzeFunctionNode(node) {
    const functionNode = node.type === AST_NODE_TYPES.MethodDefinition
        ? node.value
        : node;
    const metrics = calculateMetricsForNode(functionNode);
    const loc = node.loc;
    return {
        name: getFunctionName(node),
        type: getFunctionType(node),
        startLine: loc.start.line,
        endLine: loc.end.line,
        metrics,
    };
}
export function analyzeFile(code, filePath) {
    try {
        const ast = parseTypeScript(code);
        const functions = [];
        traverseAST(ast, (node) => {
            if (isAnalyzableFunction(node)) {
                functions.push(analyzeFunctionNode(node));
            }
        });
        return {
            fileMetrics: calculateMetricsForNode(ast),
            functions: functions.sort((a, b) => a.startLine - b.startLine),
        };
    }
    catch (error) {
        console.error(`Failed to parse ${filePath}: ${error.message}`);
        return {
            fileMetrics: {
                linesOfCode: 0,
                cyclomaticComplexity: 0,
                maintainabilityIndex: 0,
                depthOfInheritance: 0,
                classCount: 0,
                methodCount: 0,
                averageMethodComplexity: 0,
            },
            functions: [],
        };
    }
}
export function calculateMetrics(code, filePath) {
    const analysis = analyzeFile(code, filePath);
    return analysis.fileMetrics;
}
export function countLogicalLinesOfCode(ast) {
    let loc = 0;
    traverseAST(ast, (node) => {
        if (isExecutableNode(node)) {
            loc++;
        }
    });
    return loc;
}
const CONTROL_FLOW_NODES = new Set([
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
const LOGICAL_OPERATORS = new Set(["&&", "||", "??"]);
function isComplexityIncreasingNode(node) {
    if (CONTROL_FLOW_NODES.has(node.type)) {
        return true;
    }
    if (node.type === AST_NODE_TYPES.SwitchCase) {
        return node.test !== null;
    }
    if (node.type === AST_NODE_TYPES.LogicalExpression) {
        return LOGICAL_OPERATORS.has(node.operator);
    }
    return false;
}
export function calculateCyclomaticComplexity(ast) {
    let complexity = 1; // Base complexity is 1
    traverseAST(ast, (node) => {
        if (isComplexityIncreasingNode(node)) {
            complexity++;
        }
    });
    return complexity;
}
function processExpressionOperator(node, data) {
    data.operators.add(node.operator);
    data.operatorCount++;
}
function processIdentifier(node, data) {
    data.operands.add(node.name);
    data.operandCount++;
}
function processLiteral(node, data) {
    data.operands.add(String(node.value));
    data.operandCount++;
}
function processCallExpression(node, data) {
    if (node.callee.type === AST_NODE_TYPES.Identifier) {
        data.operators.add(`${node.callee.name}()`);
        data.operatorCount++;
    }
}
function processMemberExpression(node, data) {
    if (node.property.type === AST_NODE_TYPES.Identifier) {
        data.operands.add(node.property.name);
        data.operandCount++;
    }
}
function gatherHalsteadMetrics(ast) {
    const data = {
        operators: new Set(),
        operands: new Set(),
        operatorCount: 0,
        operandCount: 0
    };
    traverseAST(ast, (node) => {
        switch (node.type) {
            case AST_NODE_TYPES.BinaryExpression:
            case AST_NODE_TYPES.LogicalExpression:
            case AST_NODE_TYPES.AssignmentExpression:
            case AST_NODE_TYPES.UpdateExpression:
            case AST_NODE_TYPES.UnaryExpression:
                processExpressionOperator(node, data);
                break;
            case AST_NODE_TYPES.Identifier:
                processIdentifier(node, data);
                break;
            case AST_NODE_TYPES.Literal:
                processLiteral(node, data);
                break;
            case AST_NODE_TYPES.CallExpression:
                processCallExpression(node, data);
                break;
            case AST_NODE_TYPES.MemberExpression:
                processMemberExpression(node, data);
                break;
            case AST_NODE_TYPES.ConditionalExpression:
                data.operators.add("?:");
                data.operatorCount++;
                break;
            case AST_NODE_TYPES.NewExpression:
                data.operators.add("new");
                data.operatorCount++;
                break;
        }
    });
    return data;
}
function calculateVolumeMetric(data) {
    const vocabulary = data.operators.size + data.operands.size;
    const length = data.operatorCount + data.operandCount;
    return vocabulary > 0 ? length * Math.log2(vocabulary) : 0;
}
export function calculateHalsteadMetrics(ast) {
    const data = gatherHalsteadMetrics(ast);
    const volume = calculateVolumeMetric(data);
    return { volume };
}
export function calculateMaintainabilityIndex(volume, complexity, linesOfCode) {
    const volumeLog = volume > 0 ? Math.log(volume) : 0;
    const locLog = linesOfCode > 0 ? Math.log(linesOfCode) : 0;
    const mi = 171 - 5.2 * volumeLog - 0.23 * complexity - 16.2 * locLog;
    return Math.max(0, (mi * 100) / 171);
}
export function analyzeClassStructure(ast) {
    const inheritanceMap = new Map();
    let classCount = 0;
    traverseAST(ast, (node) => {
        if (node.type === AST_NODE_TYPES.ClassDeclaration && node.id) {
            classCount++;
            let depth = 1;
            if (node.superClass &&
                node.superClass.type === AST_NODE_TYPES.Identifier) {
                const superClassName = node.superClass.name;
                depth = (inheritanceMap.get(superClassName) || 1) + 1;
            }
            inheritanceMap.set(node.id.name, depth);
        }
    });
    const maxInheritanceDepth = Math.max(...inheritanceMap.values(), 0);
    return { classCount, maxInheritanceDepth };
}
export function analyzeFunctionStructure(ast) {
    let functionCount = 0;
    traverseAST(ast, (node) => {
        if (node.type === AST_NODE_TYPES.FunctionDeclaration ||
            node.type === AST_NODE_TYPES.FunctionExpression ||
            node.type === AST_NODE_TYPES.ArrowFunctionExpression ||
            node.type === AST_NODE_TYPES.MethodDefinition) {
            functionCount++;
        }
    });
    return { functionCount };
}
