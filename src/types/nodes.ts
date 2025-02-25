import { AST_NODE_TYPES, TSESTree } from "@typescript-eslint/typescript-estree";

export type NodeType = keyof typeof AST_NODE_TYPES;

export interface NodeTypeGuards {
  [key: string]: (node: TSESTree.Node) => boolean;
}

export type NodeProcessor<T> = (node: TSESTree.Node) => T;
export type NodeVisitor = (node: TSESTree.Node) => void;

export interface NodeMatcher<T> {
  readonly type: NodeType;
  readonly process: NodeProcessor<T>;
}

export type TypedNode<T extends NodeType> = Extract<TSESTree.Node, { type: T }>;

// Use type intersection instead of interface extension
export type FunctionLike = TSESTree.Node & {
  id?: TSESTree.Identifier;
  body: TSESTree.BlockStatement;
  params: TSESTree.Parameter[];
  async: boolean;
  generator: boolean;
  expression: boolean;
};

export const isFunctionLike = (node: TSESTree.Node): node is TSESTree.FunctionLike => {
  return [
    AST_NODE_TYPES.FunctionDeclaration,
    AST_NODE_TYPES.FunctionExpression,
    AST_NODE_TYPES.ArrowFunctionExpression,
    AST_NODE_TYPES.MethodDefinition,
  ].includes(node.type as AST_NODE_TYPES);
};