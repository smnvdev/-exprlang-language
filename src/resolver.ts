import {EditorState} from "@codemirror/state";
import {NodeWeakMap, SyntaxNode} from "@lezer/common";

import {Groups, Keywords, Nodes, Operand} from "./nodes";
import {getScope} from "./props";
import {
  ArgumentDefinition,
  builtIn,
  DefinedType,
  Definition,
  ExprKind,
  FuncDefinition,
  Item,
  Kind,
  MapDefinition,
  MethodDefinition,
  PointerDefinition,
  Scope,
  TypeDefinition,
  VariableDefinition
} from "./typing";
import {syntaxTree} from "@codemirror/language";


export const resolveRef = (s: Scope, t: Definition): TypeDefinition | Definition => {
  if (t.type === Kind.Defined && t.typeName in s.types) return s.types[t.typeName];
  return t;
}

export const getBaseType = (s: Scope, t: Definition): Definition => {
  while (t.type === Kind.Defined && t.typeName in s.types) t = s.types[t.typeName];
  return t;
}

export const isNumber = (t: Definition): boolean => {
  switch (t.type) {
    case Kind.Int8: case Kind.Int16: case Kind.Int32: case Kind.Int64: case Kind.Uint8: case Kind.Uint16:
      case Kind.Uint32: case Kind.Uint64: case Kind.Float32: case Kind.Float64: case Kind.Int:
      case ExprKind.Number: case ExprKind.Float: return true;
    default: return false;
  }
};

export const isSlice = (t: Definition): boolean => t && ( t.type === Kind.Slice || t.type === Kind.Array);

export const isEquals = (a: Definition, b: Definition): boolean => {
  if (!a || !b) return false;

  // It`s may be problems place
  // if (isSlice(a) && isSlice(b)) return isEquals((a as Item).item, (b as Item).item);
  if (a.type !== b.type) return (
    (isNumber(a) && isNumber(b)) || ((a.type === ExprKind.Optional || a.type === Kind.Pointer) && b.type === Kind.Nil)
  )

  switch (a.type) {
    case Kind.Defined: return a.typeName === (b as DefinedType).typeName;
    case Kind.Channel: return isEquals(a.item, (b as Item).item);
    case Kind.Map: return isEquals(a.key, (b as MapDefinition).key) && isEquals(a.value, (b as MapDefinition).value);
    case Kind.Pointer: return isEquals(a.to, (b as PointerDefinition).to);
    case Kind.Func: return (
      a.args.length === (b as FuncDefinition).args.length &&
      a.returns.length === (b as FuncDefinition).returns.length &&
      a.args.every((arg, idx) => isEquals(arg, (b as FuncDefinition).args[idx])) &&
      a.returns.every((ret, idx) => isEquals(ret, (b as FuncDefinition).returns[idx]))
    )
  }

  return a.type === b.type;
}

export const isUnknownType = (t: Definition): boolean => !t || t.type === Kind.Any || t.type === Kind.Interface;

export const isPredicativeFunc = (name: string) => {
  switch (name) {
    case "all": case "any": case "one": case "none": case "filter": case "find":
    case "findIndex": case "findLast": case "findLastIndex": case "groupBy": case "count":
    case "map": case "reduce": case "sortBy": case "sum": return true
    default: return false
  }
};

export const getMembers = (s: Scope, src: Definition): Record<string, VariableDefinition | MethodDefinition> => {
  let members = ("methods" in src) ? {...src.methods as Record<string, VariableDefinition>}: {};

  switch (src.type) {
    case Kind.Struct: {
      members = {...members, ...src.fields};

      for (const f of Object.keys(src.fields)) {
        const field = src.fields[f];

        if (field.type === Kind.Defined && field.embedded) {
          members = {...members, ...getMembers(s, resolveRef(s, field))};
        }
      }
      break;
    }
    case Kind.Defined: {
      members = {...members, ...getMembers(s, resolveRef(s, src))};
      break;
    }
  }
  return members;
}

export const getMember = (s: Scope, src: Definition, name: string): VariableDefinition | MethodDefinition | null => {
  if (src.type === Kind.Struct && name in (src.fields ?? {})) return src.fields[name];
  if ("methods" in src && name in (src as TypeDefinition).methods) return src.methods[name];

  switch (src.type) {
    case Kind.Struct: {
      for (const f of Object.keys(src.fields)) {
        const field = src.fields[f];

        if (field.type === Kind.Defined && field.embedded) {
          const member = getMember(s,  resolveRef(s, field), name);
          if (member) return member;
        }
      }
      break;
    }
    case Kind.Defined: {
      const member = getMember(s, resolveRef(s, src), name);
      if (member) return member;
      break;
    }
    default: return null;
  }

  return null;
}

const definition = (state: EditorState, node: SyntaxNode): Definition => {
  if (!node || !node.name) return { type: Kind.Any };

  switch (node.name) {
    case Nodes.Integer: return { type: Kind.Int }
    case Nodes.Float: return { type: ExprKind.Float }
    case Nodes.String: return { type: Kind.String };
    case Nodes.Bool: return { type: Kind.Bool };
    case Nodes.Nil: return { type: Kind.Nil };
    case Nodes.RangeExpr: return { type: Kind.Slice, item: {type: Kind.Int} };
    case Nodes.VarName: {
      const name = state.doc.sliceString(node.from, node.to);

      const scope = getScope(node);
      if (name in scope.variables) return {...scope.variables[name], name} as VariableDefinition;

      const locals = getLocalScope(state, node);
      if (name in locals) return {...locals[name], name} as VariableDefinition;

      break;
    }
    case Nodes.SelectorExpr: case Nodes.OptionalSelectorExpr: {
      const source = getDefinition(state, node.getChild(Groups.Expr))
      const field = node.getChild(Nodes.FieldName);
      if (field) return getMember(getScope(node), source, state.doc.sliceString(field.from, field.to));
      break;
    }
    case Nodes.PointerSelectorExpr: {
      const pointers = getPointers(state, node);
      if (!pointers || !(Keywords.Pointer in pointers)) break;

      const source = pointers[Keywords.Pointer];
      const field = node.getChild(Nodes.FieldName);
      if (field) return getMember(getScope(node), source, state.doc.sliceString(field.from, field.to));
      break;
    }
    case Nodes.Pointer: {
      const name = state.doc.sliceString(node.from, node.to);

      const pointers = getPointers(state, node);
      if (name in pointers) return pointers[name];
      break;
    }
    case Nodes.ParenthesizedExpr: case Nodes.UnaryExpr: case Nodes.Block: case Nodes.Predicate: case Nodes.PipeExpr: {
      const children = node.getChildren(Groups.Expr);
      return getDefinition(state, children[children.length - 1])
    }
    case Nodes.Array: {
      const children = node.getChildren(Groups.Expr).map(n => getDefinition(state, n));
      if (children.length === 0) return { type: Kind.Slice, item: { type: Kind.Any } };

      for (let idx = 1; idx < children.length; idx++) {
        if (!isEquals(children[0], children[idx])) return { type: Kind.Slice, item: { type: Kind.Any } };
      }
      return { type: Kind.Slice, item: children[0] };
    }
    case Nodes.Map: {
      const values = node.getChildren(Nodes.Pair).map(n => {
        const [key, value ] = n.getChildren(Groups.Expr);
        return getDefinition(state, value)
      });

      if (values.length === 0) return { type: Kind.Map, key: { type: Kind.String }, value: { type: Kind.Any } };
      for (let idx = 1; idx < values.length; idx++) {
        if (!isEquals(values[0], values[idx])) return { type: Kind.Map, key: { type: Kind.String }, value: { type: Kind.Any } };
      }

      return { type: Kind.Map, key: { type: Kind.String }, value: values[0] };
    }
    case Nodes.IndexExpr: {
      const source = getDefinition(state, node.getChild(Groups.Expr));
      if (source.type === Kind.Array || source.type === Kind.Slice) return source.item;
      if (source.type === Kind.Map) return source.value;
      break;
    }
    case Nodes.SliceExpr: {
      const source = getDefinition(state, node.getChild(Groups.Expr));
      if (source.type === Kind.Array || source.type === Kind.Slice) return { type: Kind.Slice, item: source.item };
      break;
    }
    case Nodes.CallExpr: {
      const callable = node.getChild(Groups.Expr)

      const source = getDefinition(state, callable);
      if (source.type !== Kind.Func) break;

      let args = node.getChild(Nodes.Arguments).getChildren(Groups.Expr);
      if (node.parent && node.parent.type.is(Nodes.PipeExpr) && node.prevSibling) args = [node.parent.getChild(Groups.Expr), ...args];

      const argsDef = args.map(arg => getDefinition(state, arg));
      const t = resolveFuncGenerics(source, argsDef, state.sliceDoc(callable.from, callable.to));

      if (t.returns.length > 0) return t.returns[0];

      break;
    }
    case Nodes.BinaryExpr: {
      const op = node.getChild(Groups.Op);
      if (op.name === Nodes.CompareOp || op.name === Nodes.LogicOp) return { type: Kind.Bool }

      const [right, left] = node.getChildren(Groups.Expr);
      const r = getDefinition(state, right), l = getDefinition(state, left);
      if (isNumber(r) && isNumber(l)) return { type: ExprKind.Float }
      if (isEquals(r, l)) return r;

      break;
    }
    case Nodes.ConditionalExpr: {
      const [condition, truth, falsehood] = node.getChildren(Groups.Expr);
      const t = getDefinition(state, truth), f = getDefinition(state, falsehood);
      if (isEquals(t, f)) return t;

      if (t.type !== ExprKind.Optional) break;
      if (!condition.type.is(Nodes.BinaryExpr)) break;

      const op = condition.getChild(Groups.Op);
      if (op.name !== Nodes.CompareOp) break;

      const operand = state.doc.sliceString(op.from, op.to);
      if (operand !== Operand.Equal && operand !== Operand.NotEqual) break;

      const [right, left] = condition.getChildren(Groups.Expr);
      if (!right.type.is(Nodes.Nil) && !left.type.is(Nodes.Nil)) break;

      const src = right.type.is(Nodes.Nil) ? left: right;
      const r = operand === Operand.NotEqual ? truth: falsehood;

      if (state.doc.sliceString(src.from, src.to) === state.doc.sliceString(r.from, r.to) && isEquals(t.item, f))
        return t.item;
      break;
    }
    default: break;
  }
  return { type: Kind.Any };
}

const cache = new NodeWeakMap<any>();
export const getDefinition = (state: EditorState, node: SyntaxNode): Definition => {
  if (!node) return { type: Kind.Any };

  const cached = cache.get(node);
  if (cached) return cached;

  const def = definition(state, node);
  cache.set(node, def);
  return def;
}

const toVarDeclaration = (state: EditorState, varDecl: SyntaxNode): VariableDefinition | null => {
  if (varDecl.node.type.isError) return null;

  const name = varDecl.getChild(Nodes.DefName);
  if (!name) return null;

  const def = getDefinition(state, varDecl.getChild(Groups.Expr));

  let description = "";

  let node = varDecl.prevSibling ?? varDecl.parent.prevSibling;
  while(node && (node.name === Nodes.LineComment || node.name === Nodes.BlockComment)) {
    let content = state.sliceDoc(node.from, node.to).slice(2).trim();
    if (node.name === Nodes.BlockComment) content = content.slice(0, -2).trim();
    description = content + "\n" + description;

    node = node.prevSibling;
  }

  return { ...def, name: state.doc.sliceString(name.from, name.to), description };
}

export const getLocalScope = (state: EditorState, target: SyntaxNode, pos: number | null = null): Record<string, VariableDefinition> => {
  let scope = getPointers(state, target);

  syntaxTree(state).iterate({
    enter: ({type, node, from, to}) => {
      if (type.name === Nodes.VarDecl && to < (pos ?? target.from)) {
        const def = toVarDeclaration(state, node);
        if (def) scope = {[def.name]: def, ...scope};
      }
      return true
    },
    to: pos ?? target.from
  })

  return scope;
};


export const getPointers = (state: EditorState, node: SyntaxNode): Record<string, VariableDefinition> => {
  for (let cur = node, prev = node; cur; prev = cur, cur = cur.parent) {
    if (cur.name === Nodes.Arguments) {
      const scope = getPredicateScope(state, prev);
      if (Keywords.Pointer in scope) return scope;
    }
  }
  return {};
};


export const getPredicateScope = (state: EditorState, node: SyntaxNode): Record<string, VariableDefinition> => {
  if (!node || !node.parent) return {};
  if (node.type.is(Nodes.CloseParen)) return {};

  let call = node;
  while (call && call.name !== Nodes.Arguments) call = call.parent;
  while (call && call.name !== Nodes.CallExpr) call = call.parent;
  if (!call) return {};

  const varName = call.getChild(Nodes.Expr);
  if (!varName) return {};

  const name = state.sliceDoc(varName.from, varName.to);
  if (!isPredicativeFunc(name)) return {};

  const def = builtIn.variables[name];
  if (!def || def.type !== Kind.Func) return {};

  const args: SyntaxNode[] = []; let pos = 0;
  if (call.parent?.name === Nodes.PipeExpr && call.prevSibling) { args.push(call.parent.getChild(Groups.Expr)); pos++; }

  const argsNode = call.getChild(Nodes.Arguments);
  if (!argsNode) return {};

  args.push(...argsNode.getChildren(Groups.Expr) ?? []);
  if (!args) return {};

  let cursor = node.from;
  if (node.type.is(Nodes.Arguments) || node.type.is(Nodes.Comma) ) {cursor = state.selection.main.head;}

  pos += argsNode.getChildren(",").filter(({to}) => to <= cursor).length;
  if (pos >= def.args.length || def.args[pos].type !== Kind.Func) return {};

  const definitions = args.map((a, idx) => idx !== pos ? getDefinition(state, a): { type: Kind.Any } as Definition);

  const func = resolveFuncGenerics(def, definitions, name);
  const predicate = func.args[pos] as FuncDefinition;

  let scope =  predicate.args.reduce(
    (acc, arg) =>  ({...acc, [arg.name]: arg}), {} as Record<string, VariableDefinition>
  );

  // This trick is needed to determine the type of the '#acc' argument in the built-in 'reduce' functions.
  if (Keywords.Accumulator in scope && scope[Keywords.Accumulator].type === Kind.Any) {
    scope = {...scope, [Keywords.Accumulator]: scope[Keywords.Pointer]}
  }

  return scope;
}

export const resolveFuncGenerics = (f: FuncDefinition, args: Definition[], name: string = ""): FuncDefinition | null => {
  if (!f.generics) return f;

  let generics: Record<string, Definition> = {};
  for (let argIdx = 0; argIdx < args.length; argIdx++) {
    const defArgIdx = argIdx < f.args.length ? argIdx: f.args.length - 1;

    let expected: ArgumentDefinition = f.args[defArgIdx], actual = args[argIdx];
    if (defArgIdx != argIdx && !(expected.variadic ?? false)) break;

    if (isPredicativeFunc(name) && expected.type === Kind.Func && expected.returns.length === 1)
      expected = expected.returns[0] as ArgumentDefinition;

    generics = {...collectGenerics(expected, actual), ...generics};
  }

  Object.keys(f.generics).forEach(g => {
    // If generic is not resolved, then we set it to Any
    if (!(g in generics)) generics[g] = { type: Kind.Any };

    // Check if generic is resolved to one of the types from the list
    // else set it to the first type from the list
    let equals = false;
    for (let t of f.generics[g]) {
      if (isUnknownType(t) || isEquals(generics[g], t)) {
        equals = true
        break;
      }
    }

    if (!equals) generics[g] = f.generics[g][0]
  })

  return patchGenerics(generics, f) as FuncDefinition;
}

const collectGenerics = (t: Definition, a: Definition): Record<string, Definition> => {
  if (!t || !a) return {};

  if (t.type === Kind.Generic) return {[t.generic]: a};

  switch (t.type) {
    case Kind.Array: case Kind.Slice: case Kind.Channel:
      if (a.type === t.type) return collectGenerics(t.item, a.item);
      break;
    case Kind.Map:
      if (a.type === t.type) return { ...collectGenerics(t.key, a.key), ...collectGenerics(t.value, a.value) };
      break;
    case Kind.Pointer: {
      if (a.type === t.type) return collectGenerics(t.to, a.to);
      break
    }
    case Kind.Func: {
      if (a.type === t.type) return {
        ...t.args.reduce((acc, arg, idx) => ({...acc, ...collectGenerics(arg, a.args[idx])}), {}),
        ...t.returns.reduce((acc, ret, idx) => ({...acc, ...collectGenerics(ret, a.returns[idx])}), {})
      }
      break;
    }
  }
  return {};
}

const patchGenerics = (m: Record<string, Definition>, t: Definition): Definition => {
  switch (t.type) {
    case Kind.Slice: case Kind.Array: case Kind.Channel: return { ...t, item: patchGenerics(m, t.item) };
    case Kind.Map: return { type: Kind.Map, key: patchGenerics(m, t.key), value: patchGenerics(m, t.value) };
    case Kind.Pointer: return { ...t, to: patchGenerics(m, t.to) };
    case ExprKind.Optional: return { ...t, item: patchGenerics(m, t.item) };
    case Kind.Func: {
      const { generics, ...rest } = t;
      return {
        ...rest,
        args: t.args.map(a => patchGenerics(m, a) as ArgumentDefinition),
        returns: t.returns.map(r => patchGenerics(m, r)),
      }
    }
    case Kind.Generic: {
      const { generic, ...rest} = t;
      return {...rest, ...m[t.generic]}
    }
    default: return t;
  }
}