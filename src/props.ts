import { NodeProp, SyntaxNode } from "@lezer/common";

import { builtIn, Scope } from "./typing";

const prop = new NodeProp({ perNode: false });

export const getScope = (node: SyntaxNode): Scope => {
  return node.type.prop(prop) as Scope;
}

export const setScope = (scope: Scope) => {
  return prop.add(() => scope);
}

export const buildScope = (scope?: Scope): Scope => ({
  variables: {...builtIn.variables, ...scope?.variables},
  types: {...builtIn.types, ...scope?.types},
})