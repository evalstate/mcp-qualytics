import { AST_NODE_TYPES } from "@typescript-eslint/typescript-estree";
export const isFunctionLike = (node) => {
    return [
        AST_NODE_TYPES.FunctionDeclaration,
        AST_NODE_TYPES.FunctionExpression,
        AST_NODE_TYPES.ArrowFunctionExpression,
        AST_NODE_TYPES.MethodDefinition,
    ].includes(node.type);
};
