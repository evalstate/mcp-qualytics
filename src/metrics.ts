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

function getFunctionName(node: TSESTree.Node): string {
  switch (node.type) {
    case AST_NODE_TYPES.FunctionDeclaration:
      return node.id?.name || '<anonymous>';
    case AST_NODE_TYPES.MethodDefinition:
      return node.key.type === AST_NODE_TYPES.Identifier ? node.key.name : '<computed>';
    case AST_NODE_TYPES.ArrowFunctionExpression:
      if (node.parent?.type === AST_NODE_TYPES.VariableDeclarator && 
          node.parent.id.type === AST_NODE_TYPES.Identifier) {
        return node.parent.id.name;
      }
      return '<arrow>';
    case AST_NODE_TYPES.FunctionExpression:
      if (node.parent?.type === AST_NODE_TYPES.VariableDeclarator && 
          node.parent.id.type === AST_NODE_TYPES.Identifier) {
        return node.parent.id.name;
      }
      return '<anonymous>';
    default:
      return '<unknown>';
  }
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

export function analyzeFile(code: string, filePath: string): FileAnalysis {
  let ast: TSESTree.Program;

  try {
    ast = parse(code, {
      loc: true,
      range: true,
      comment: true,
      tokens: true,
      sourceType: "module",
      ecmaFeatures: {
        jsx: true,
      },
    });
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

  const functions: FunctionInfo[] = [];
  
  traverseAST(ast, (node) => {
    if (
      node.type === AST_NODE_TYPES.FunctionDeclaration ||
      node.type === AST_NODE_TYPES.FunctionExpression ||
      node.type === AST_NODE_TYPES.ArrowFunctionExpression ||
      node.type === AST_NODE_TYPES.MethodDefinition
    ) {
      const functionNode = node.type === AST_NODE_TYPES.MethodDefinition ? node.value : node;
      const metrics = calculateMetricsForNode(functionNode);
      const loc = node.loc!;

      functions.push({
        name: getFunctionName(node),
        type: getFunctionType(node),
        startLine: loc.start.line,
        endLine: loc.end.line,
        metrics,
      });
    }
  });

  return {
    fileMetrics: calculateMetricsForNode(ast),
    functions: functions.sort((a, b) => a.startLine - b.startLine),
  };
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

export function calculateCyclomaticComplexity(ast: TSESTree.Node): number {
  let complexity = 0;
  traverseAST(ast, (node) => {
    switch (node.type) {
      case AST_NODE_TYPES.IfStatement:
      case AST_NODE_TYPES.ForStatement:
      case AST_NODE_TYPES.ForInStatement:
      case AST_NODE_TYPES.ForOfStatement:
      case AST_NODE_TYPES.WhileStatement:
      case AST_NODE_TYPES.DoWhileStatement:
      case AST_NODE_TYPES.CatchClause:
      case AST_NODE_TYPES.ConditionalExpression:
        complexity++;
        break;
      case AST_NODE_TYPES.SwitchCase:
        if ((node as TSESTree.SwitchCase).test !== null) {
          complexity++;
        }
        break;
      case AST_NODE_TYPES.LogicalExpression:
        if (
          ["&&", "||", "??"].includes(
            (node as TSESTree.LogicalExpression).operator
          )
        ) {
          complexity++;
        }
        break;
      case AST_NODE_TYPES.TryStatement:
      case AST_NODE_TYPES.ThrowStatement:
        complexity++;
        break;
    }
  });
  return complexity + 1;
}

export function calculateHalsteadMetrics(
  ast: TSESTree.Node
): HalsteadMetrics {
  const operators = new Set<string>();
  const operands = new Set<string>();
  let operatorCount = 0;
  let operandCount = 0;

  traverseAST(ast, (node) => {
    switch (node.type) {
      case AST_NODE_TYPES.BinaryExpression:
      case AST_NODE_TYPES.LogicalExpression:
      case AST_NODE_TYPES.AssignmentExpression:
      case AST_NODE_TYPES.UpdateExpression:
      case AST_NODE_TYPES.UnaryExpression:
        const operatorNode = node as
          | TSESTree.BinaryExpression
          | TSESTree.LogicalExpression
          | TSESTree.AssignmentExpression
          | TSESTree.UpdateExpression
          | TSESTree.UnaryExpression;
        operators.add(operatorNode.operator);
        operatorCount++;
        break;
      case AST_NODE_TYPES.Identifier:
        const identifierNode = node as TSESTree.Identifier;
        operands.add(identifierNode.name);
        operandCount++;
        break;
      case AST_NODE_TYPES.Literal:
        const literalNode = node as TSESTree.Literal;
        operands.add(String(literalNode.value));
        operandCount++;
        break;
      case AST_NODE_TYPES.CallExpression:
        const callNode = node as TSESTree.CallExpression;
        if (callNode.callee.type === AST_NODE_TYPES.Identifier) {
          operators.add(`${callNode.callee.name}()`);
          operatorCount++;
        }
        break;
      case AST_NODE_TYPES.MemberExpression:
        const memberNode = node as TSESTree.MemberExpression;
        if (memberNode.property.type === AST_NODE_TYPES.Identifier) {
          operands.add(memberNode.property.name);
          operandCount++;
        }
        break;
      case AST_NODE_TYPES.ConditionalExpression:
        operators.add("?:");
        operatorCount++;
        break;
      case AST_NODE_TYPES.NewExpression:
        operators.add("new");
        operatorCount++;
        break;
    }
  });

  const n1 = operators.size;
  const n2 = operands.size;
  const N1 = operatorCount;
  const N2 = operandCount;
  const vocabulary = n1 + n2;
  const length = N1 + N2;
  const volume = vocabulary > 0 ? length * Math.log2(vocabulary) : 0;

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