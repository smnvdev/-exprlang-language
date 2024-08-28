import { Completion, CompletionSource } from "@codemirror/autocomplete";
import { syntaxTree } from "@codemirror/language";
import { EditorState } from "@codemirror/state";
import { SyntaxNode } from "@lezer/common";

import { Keywords, Nodes } from "./nodes";
import { builtIn, Definition, ExprKind, FuncDefinition, Kind, VariableDefinition } from "./typing";
import { getDefinition, getLocalScope, getMembers, getPointers } from "./resolver"
import { getScope } from "./props";

enum Boost {
  BuiltIn = 2,
  Keyword = 4,
  Constant = 6,
  Variable = 8,
  Method = 10,
  Property = 12,
}

const funcToDetails = (t: FuncDefinition): [string, string] => {
  const args = t.args;
  const required = args.filter(a => a.required ?? true).map(a => (a.variadic ? "...": "") + a.name + " " + toDetails(a)).join(", ");
  const optional = args.filter(a => !(a.required ?? true)).map(a => (a.variadic ? "...": "") + a.name + " " + toDetails(a)).join(", ");

  const receiver =  "receiver" in t ? ` -> ${toDetails(t.receiver as Definition)}`: "";

  const returns = t.returns.map(r => toDetails(r)).join(", ");

  return [`(${required}${optional ? `[, ${optional}]`: ''})${receiver}`, `${t.returns.length > 1 ? `(${returns})`: returns}`];
}

export const toDetails = (t: Definition): string => {
  switch (t.type) {
    case ExprKind.Optional: return "?" + toDetails(t.item); /*  */

    case Kind.Pointer: return `*${toDetails(t.to)}`;
    case Kind.Channel: return `chan ${toDetails(t.item)}`;
    case Kind.Slice:   return `[]${toDetails(t.item)}`;
    case Kind.Array:   return `[${t.size ?? ""}]${toDetails(t.item)}`;
    case Kind.Map:     return `map[${toDetails(t.key)}]${toDetails(t.value)}`;
    case Kind.Func:    return `func${funcToDetails(t).join(" ")}`;
    case Kind.Generic: return `any`;
    case Kind.Defined: return t.typeName;
    default:           return t.type;
  }
}

export const toCompletion = (label: string, t: VariableDefinition, props?: Partial<Completion>): Completion => {
  if (t.deprecated) props = {...props, deprecated: true, boost: (props?.boost ?? 0) - 1} as Partial<Completion>;

  switch (t.type) {
    case Kind.Func: {
      const [detail, returns] = funcToDetails(t)
      return {
        label, detail, returns, type: "function", ...props,
        apply: (v, c, from, to) => {
          const word = v.state.wordAt(from);
          v.dispatch({
            changes: { from, to: word?.to ?? to, insert: c.label + "()" },
            selection: { anchor: from + c.label.length + (t.args.length > 0 ? 1: 2) }
          })
        }
      } as Completion;
    }
    default: return { label, type: "variable", returns: toDetails(t), ...props} as Completion;
  }
}

export const toCompletions = (vars: Record<string, VariableDefinition>, props?: Partial<Completion>): Completion[] => {
  return Object.keys(vars).map(v => toCompletion(v, vars[v], props))
}

const dontComplete = (node: SyntaxNode) => {
  switch (node.name) {
    case Nodes.String:  case Nodes.LineComment: case Nodes.BlockComment: case Nodes.DefName: case Nodes.Pointer:
    case Nodes.FieldName: case Nodes.Dot:  case Nodes.NilSelector: case Nodes.LogicOp: case Keywords.Not:
      return true
    default:
      return false
  }
}

export const reIdentifier = /^[\w$\xa1-\uffff][\w$\d\xa1-\uffff]*$/;
const nodeIsWord = (state: EditorState, inner: SyntaxNode, re: RegExp = reIdentifier) => (
  inner.name === Nodes.VarName || inner.name === Nodes.FieldName ||
  inner.to - inner.from < 20 && re.test(state.sliceDoc(inner.from, inner.to))
)

export const globalCompletionSource: CompletionSource = context => {
  const inner = syntaxTree(context.state).resolveInner(context.pos, -1);

  if (dontComplete(inner)) return null

  const isWord = nodeIsWord(context.state, inner)
  if (!isWord && !context.explicit) return null;

  const scope = getScope(inner)
  const options = Object.keys(scope.variables).map((variable) => {
    const boost = variable in builtIn.variables ? Boost.BuiltIn: Boost.Variable;
    return toCompletion(variable, scope.variables[variable], { boost })
  })

  return {
    from: isWord ? inner.from: context.pos, validFor: reIdentifier,
    options: options.concat([
      { label: Keywords.Let, type: "keyword", boost: Boost.Keyword },
      { label: Keywords.Nil, type: "keyword", boost: Boost.Keyword },
      { label: Keywords.True, type: "keyword", boost: Boost.Keyword },
      { label: Keywords.False, type: "keyword", boost: Boost.Keyword }
    ])
  }
};

export const localCompletionSource: CompletionSource = context => {
  let inner = syntaxTree(context.state).resolveInner(context.pos, -1);

  if (inner.parent && inner.parent.type.is(Nodes.PointerSelectorExpr)) inner = inner.parent;

  if (dontComplete(inner) && !inner.type.is(Nodes.Dot) && !inner.type.is(Nodes.FieldName)) return null;
  if (inner.parent && (inner.parent.type.is(Nodes.SelectorExpr) || inner.parent.type.is(Nodes.OptionalSelectorExpr))) return null;

  const isWord = nodeIsWord(context.state, inner, /^[\w$\xa1-\uffff.][\w$\d\xa1-\uffff]*$/)
  if (!isWord && !context.explicit) return null;

  const locals = getLocalScope(context.state, inner, context.pos);
  const options = toCompletions(locals, { boost: Boost.Variable });

  if (Keywords.Pointer in locals) {
    const pointer = locals[Keywords.Pointer];
    const members = getMembers(getScope(inner), pointer);

    Object.keys(members).forEach(member => {
        const boost = "receiver" in members[member] ? Boost.Method : Boost.Property
        options.push(toCompletion("." + member, members[member], { boost }))
    })
  }

  return { options, from: isWord ? inner.from: context.pos, validFor: /^[\w$\xa1-\uffff.][\w$\d\xa1-\uffff]*$/ }
}


export const binaryCompletionSource: CompletionSource = context => {
  const inner = syntaxTree(context.state).resolveInner(context.pos, -1);
  if (!inner || !inner.prevSibling  || dontComplete(inner)) return null;

  const isWord = nodeIsWord(context.state, inner)
  if (!isWord && !context.explicit) return null;

  let before = inner.prevSibling;
  let length = before.to - before.from;

  before = syntaxTree(context.state).resolveInner(length > 1 ? before.to - 1: before.to, -1);
  if (before.parent && before.parent.prevSibling && before.parent.name === Nodes.LogicOp) {
    before = before.parent.prevSibling;
    length = before.to - before.from;
    before = syntaxTree(context.state).resolveInner(length > 1 ? before.to - 1: before.to, -1)
  }
  const t = getDefinition(context.state, before);

  const options: Completion[] = [
    { label: Keywords.Not, type: "keyword", boost: Boost.Keyword },
    { label: Keywords.In, type: "keyword", boost: Boost.Keyword }
  ]
  if (t.type === Kind.String) {
    options.push(
      { label: Keywords.Contains,   type: "keyword", boost: Boost.Keyword },
      { label: Keywords.StartsWith, type: "keyword", boost: Boost.Keyword },
      { label: Keywords.EndsWith,   type: "keyword", boost: Boost.Keyword },
      { label: Keywords.Matches,    type: "keyword", boost: Boost.Keyword },
    )
  }

  return { options, from: isWord ? inner.from: context.pos, validFor: reIdentifier }
}


export const selectorCompletionSource: CompletionSource = context => {
  const inner = syntaxTree(context.state).resolveInner(context.pos, -1);
  if (!inner || !inner.parent) return null;

  const parent = inner.parent;
  if (parent.name !== Nodes.SelectorExpr && parent.name !== Nodes.OptionalSelectorExpr) return null;

  const isWord = nodeIsWord(context.state, inner);

  let src: Definition;
  if (parent && (parent.name === Nodes.SelectorExpr || parent.name === Nodes.OptionalSelectorExpr)) {
    src = getDefinition(context.state, parent.getChild("Expr"));
  }

  if (!src) {
    const pointers = getPointers(context.state, inner);
    if (!(Keywords.Pointer in pointers)) return null;
    src = pointers[Keywords.Pointer];
  }

  const members = getMembers(getScope(inner), src);
  const options = Object.keys(members).map(
    member => toCompletion(member, members[member], { boost: "receiver" in members[member] ? Boost.Method : Boost.Property })
  )

  if (!options) return null;
  return { options, from: isWord ? inner.from: context.pos, validFor: reIdentifier };
}
