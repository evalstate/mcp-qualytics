import {
  AST_NODE_TYPES,
  TSESTree,
  parse,
} from "@typescript-eslint/typescript-estree";
import { isExecutableNode, traverseAST } from "./ast-utils.js";
import { CodeMetrics, HalsteadMetrics, FunctionInfo, FileAnalysis } from "./types.js";

function calculateMetricsForNode(node: TSESTree.Node): CodeMetrics {
  const linesOfCode = countLogicalLinesOfCode(node);
  const cyclomaticComplexity = calculateCyclomaticComplexity(node);
  const halsteadMetrics = calculateHalsteadMetrics(node);
  const maintainabilityIndex = calculateMaintainabilityIndex(
    halsteadMetrics.volume,
    cyclomaticComplexity,
    linesOfCode
  );
  const classStructure = analyzeClassStructure(node);
  const functionMetrics = analyzeFunctionStructure(node);
  const averageMethodComplexity =
    functionMetrics.functionCount > 0
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

interface FunctionNameExtractor {
  (node: TSESTree.Node): string;
}

const functionNameExtractors: Record<string, FunctionNameExtractor> = {
  [AST_NODE_TYPES.FunctionDeclaration]: (node: TSESTree.Node) => 
    (node as TSESTree.FunctionDeclaration).id?.name || '<anonymous>',

  [AST_NODE_TYPES.MethodDefinition]: (node: TSESTree.Node) => {
    const methodNode = node as TSESTree.MethodDefinition;
    return methodNode.key.type === AST_NODE_TYPES.Identifier ? methodNode.key.name : '<computed>';
  },

  [AST_NODE_TYPES.ArrowFunctionExpression]: (node: TSESTree.Node) => {
    const parent = node.parent;
    if (parent?.type === AST_NODE_TYPES.VariableDeclarator && 
        parent.id.type === AST_NODE_TYPES.Identifier) {
      return parent.id.name;
    }
    return '<arrow>';
  },

  [AST_NODE_TYPES.FunctionExpression]: (node: TSESTree.Node) => {
    const parent = node.parent;
    if (parent?.type === AST_NODE_TYPES.VariableDeclarator && 
        parent.id.type === AST_NODE_TYPES.Identifier) {
      return parent.id.name;
    }
    return '<anonymous>';
  }
};

function getFunctionName(node: TSESTree.Node): string {
  const extractor = functionNameExtractors[node.type];
  return extractor ? extractor(node) : '<unknown>';
}

function getFunctionType(node: TSESTree.Node): 'function' | 'method' | 'arrow' {
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

interface ParseOptions {
  loc: boolean;
  range: boolean;
  comment: boolean;
  tokens: boolean;
  sourceType: "module";
  ecmaFeatures: {
    jsx: boolean;
  };
}

const DEFAULT_PARSE_OPTIONS: ParseOptions = {
  loc: true,
  range: true,
  comment: true,
  tokens: true,
  sourceType: "module",
  ecmaFeatures: {
    jsx: true,
  },
};

function parseTypeScript(code: string): TSESTree.Program {
  return parse(code, DEFAULT_PARSE_OPTIONS);
}

function isAnalyzableFunction(node: TSESTree.Node): boolean {
  return (
    node.type === AST_NODE_TYPES.FunctionDeclaration ||
    node.type === AST_NODE_TYPES.FunctionExpression ||
    node.type === AST_NODE_TYPES.ArrowFunctionExpression ||
    node.type === AST_NODE_TYPES.MethodDefinition
  );
}

function analyzeFunctionNode(node: TSESTree.Node): FunctionInfo {
  const functionNode = node.type === AST_NODE_TYPES.MethodDefinition 
    ? (node as TSESTree.MethodDefinition).value 
    : node;
  
  const metrics = calculateMetricsForNode(functionNode);
  const loc = node.loc!;

  return {
    name: getFunctionName(node),
    type: getFunctionType(node),
    startLine: loc.start.line,
    endLine: loc.end.line,
    metrics,
  };
}

export function analyzeFile(code: string, filePath: string): FileAnalysis {
  try {
    const ast = parseTypeScript(code);
    const functions: FunctionInfo[] = [];

    traverseAST(ast, (node) => {
      if (isAnalyzableFunction(node)) {
        functions.push(analyzeFunctionNode(node));
      }
    });

    return {
      fileMetrics: calculateMetricsForNode(ast),
      functions: functions.sort((a, b) => a.startLine - b.startLine),
    };
  } catch (error: any) {
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

export function calculateMetrics(code: string, filePath: string): CodeMetrics {
  const analysis = analyzeFile(code, filePath);
  return analysis.fileMetrics;
}

export function countLogicalLinesOfCode(ast: TSESTree.Node): number {
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

function isComplexityIncreasingNode(node: TSESTree.Node): boolean {
  if (CONTROL_FLOW_NODES.has(node.type)) {
    return true;
  }

  if (node.type === AST_NODE_TYPES.SwitchCase) {
    return (node as TSESTree.SwitchCase).test !== null;
  }

  if (node.type === AST_NODE_TYPES.LogicalExpression) {
    return LOGICAL_OPERATORS.has((node as TSESTree.LogicalExpression).operator);
  }

  return false;
}

export function calculateCyclomaticComplexity(ast: TSESTree.Node): number {
  let complexity = 1; // Base complexity is 1

  traverseAST(ast, (node) => {
    if (isComplexityIncreasingNode(node)) {
      complexity++;
    }
  });

  return complexity;
}

interface HalsteadData {
  operators: Set<string>;
  operands: Set<string>;
  operatorCount: number;
  operandCount: number;
}

function processExpressionOperator(
  node: TSESTree.BinaryExpression | TSESTree.LogicalExpression | TSESTree.AssignmentExpression | TSESTree.UpdateExpression | TSESTree.UnaryExpression,
  data: HalsteadData
): void {
  data.operators.add(node.operator);
  data.operatorCount++;
}

function processIdentifier(node: TSESTree.Identifier, data: HalsteadData): void {
  data.operands.add(node.name);
  data.operandCount++;
}

function processLiteral(node: TSESTree.Literal, data: HalsteadData): void {
  data.operands.add(String(node.value));
  data.operandCount++;
}

function processCallExpression(node: TSESTree.CallExpression, data: HalsteadData): void {
  if (node.callee.type === AST_NODE_TYPES.Identifier) {
    data.operators.add(`${node.callee.name}()`);
    data.operatorCount++;
  }
}

function processMemberExpression(node: TSESTree.MemberExpression, data: HalsteadData): void {
  if (node.property.type === AST_NODE_TYPES.Identifier) {
    data.operands.add(node.property.name);
    data.operandCount++;
  }
}

function gatherHalsteadMetrics(ast: TSESTree.Node): HalsteadData {
  const data: HalsteadData = {
    operators: new Set<string>(),
    operands: new Set<string>(),
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
        processExpressionOperator(node as any, data);
        break;
      case AST_NODE_TYPES.Identifier:
        processIdentifier(node as TSESTree.Identifier, data);
        break;
      case AST_NODE_TYPES.Literal:
        processLiteral(node as TSESTree.Literal, data);
        break;
      case AST_NODE_TYPES.CallExpression:
        processCallExpression(node as TSESTree.CallExpression, data);
        break;
      case AST_NODE_TYPES.MemberExpression:
        processMemberExpression(node as TSESTree.MemberExpression, data);
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

function calculateVolumeMetric(data: HalsteadData): number {
  const vocabulary = data.operators.size + data.operands.size;
  const length = data.operatorCount + data.operandCount;
  return vocabulary > 0 ? length * Math.log2(vocabulary) : 0;
}

export function calculateHalsteadMetrics(ast: TSESTree.Node): HalsteadMetrics {
  const data = gatherHalsteadMetrics(ast);
  const volume = calculateVolumeMetric(data);
  return { volume };
}

export function calculateMaintainabilityIndex(
  volume: number,
  complexity: number,
  linesOfCode: number
): number {
  const volumeLog = volume > 0 ? Math.log(volume) : 0;
  const locLog = linesOfCode > 0 ? Math.log(linesOfCode) : 0;

  const mi = 171 - 5.2 * volumeLog - 0.23 * complexity - 16.2 * locLog;
  return Math.max(0, (mi * 100) / 171);
}

export function analyzeClassStructure(ast: TSESTree.Node): {
  classCount: number;
  maxInheritanceDepth: number;
} {
  const inheritanceMap = new Map<string, number>();
  let classCount = 0;

  traverseAST(ast, (node) => {
    if (node.type === AST_NODE_TYPES.ClassDeclaration && node.id) {
      classCount++;
      let depth = 1;

      if (
        node.superClass &&
        node.superClass.type === AST_NODE_TYPES.Identifier
      ) {
        const superClassName = node.superClass.name;
        depth = (inheritanceMap.get(superClassName) || 1) + 1;
      }

      inheritanceMap.set(node.id.name, depth);
    }
  });

  const maxInheritanceDepth = Math.max(...inheritanceMap.values(), 0);
  return { classCount, maxInheritanceDepth };
}

export function analyzeFunctionStructure(ast: TSESTree.Node): {
  functionCount: number;
} {
  let functionCount = 0;

  traverseAST(ast, (node) => {
    if (
      node.type === AST_NODE_TYPES.FunctionDeclaration ||
      node.type === AST_NODE_TYPES.FunctionExpression ||
      node.type === AST_NODE_TYPES.ArrowFunctionExpression ||
      node.type === AST_NODE_TYPES.MethodDefinition
    ) {
      functionCount++;
    }
  });

  return { functionCount };
}