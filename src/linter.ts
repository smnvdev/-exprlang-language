import { SyntaxNode }  from "@lezer/common";
import { Diagnostic }  from "@codemirror/lint";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";

import {Definition, ExprKind, Kind} from "./typing";
import { Groups, Keywords, Nodes, Operand } from "./nodes";
import {
  getDefinition,
  getLocalScope, getPointers,
  isNumber, isPredicativeFunc, isEquals, isUnknownType, resolveFuncGenerics, getMember, resolveRef, getBaseType
} from "./resolver"
import { getScope } from "./props";
import { toDetails } from "./complete";

const createElement = (tag: string, attrs: {}): HTMLElement => {
  const node = document.createElement(tag);
  for (const key in attrs) node[key] = attrs[key];
  return node;
}

const noRedeclareVar = (state: EditorState, node: SyntaxNode): Diagnostic[] => {
  if (!node.lastChild || node.lastChild.type.isError) return [];

  const defName = node.getChild(Nodes.DefName);
  if (!defName) return [];

  const name = state.sliceDoc(defName.from, defName.to);
  if (name === Keywords.Env) return [{
    from: defName.from, to: defName.to, severity: "warning", message: `Trying redeclare '${Keywords.Env}' variable`,
    renderMessage: () => createElement("span", {
      innerHTML: `Trying redeclare <b>${Keywords.Env}</b> variable`
    })
  }];

  if (name in getScope(node).variables) return [{
    from: defName.from, to: defName.to, severity: "error", message: `Cannot redeclare environment variable '${name}'`,
    renderMessage: () => createElement("span", {
      innerHTML: `Cannot redeclare environment variable <b>${name}</b>`
    })
  }];

  if (name in getLocalScope(state, node)) return [{
    from: defName.from, to: defName.to, severity: "error", message: `Cannot redeclare local variable '${name}'`,
    renderMessage: () => createElement("span", {
      innerHTML: `Cannot redeclare local variable <b>${name}</b>`
    })
  }];

  return [];
}

const noUnknownVar = (state: EditorState, node: SyntaxNode): Diagnostic[] => {
  const name = state.sliceDoc(node.from, node.to);
  if (name in getScope(node).variables || name in getLocalScope(state, node)) return [];

  return [{
    from: node.from, to: node.to, severity: "error", markClass: "cm-undefined", message: `Unknown variable '${name}'`,
    renderMessage: () => createElement("span", { innerHTML: `Unknown variable <b>${name}</b>`})
  }];
}

const noDeclareVarUsingBuiltinFunc = (state: EditorState, node: SyntaxNode): Diagnostic[] => {
  const value = node.getChild(Groups.Expr);

  if (value && value.name === Nodes.VarName) {
    const name = state.sliceDoc(value.from, value.to);

    if (name in getScope(node).variables) return [{
      from: value.from, to: value.to, severity: "error", message: `Cannot use built-in function as value`,
      renderMessage: () => createElement("span", {
        innerHTML: `Cannot use <b>built-in</b> function <b>${name}</b> as value`
      })
    }]
  }

  return [];
}

const noUnusedBlock = (state: EditorState, node: SyntaxNode): Diagnostic[] => {
  if (state.doc.lineAt(node.from).number != state.doc.lineAt(node.to).number) return [];
  const apply = (v: EditorView) => v.dispatch({ changes: [
    { from: node.from, to: node.from + 1, insert: "" }, { from: node.to - 1, to: node.to, insert: "" }
  ]})

  return [
    {
      from: node.from, to: node.from + 1, severity: "warning", message: `Unused braces`,
      actions: [{ name: "Remove braces", apply }]
    },
    {
      from: node.to - 1, to: node.to, severity: "warning", message: `Unused braces`,
      actions: [{ name: "Remove braces", apply }]
    }
  ]
}

const noInvalidString = (state: EditorState, node: SyntaxNode): Diagnostic[] => {
  const firstChar = state.doc.sliceString(node.from, node.from + 1);
  const lastChar = state.doc.sliceString(node.to - 1, node.to);

  if (firstChar === lastChar) return [];
  return [{ from: node.from, to: node.to, severity: "error", message: "Invalid string" }];
}

const noInvalidVarDeclaration = (_: EditorState, node: SyntaxNode): Diagnostic[] => {
  const defNameNode = node.getChild(Nodes.DefName);
  if (!defNameNode) return [{ from: node.from, to: node.to, severity: "error",  message: "Expected variable name" }]

  const equal = node.getChild("="), expr = node.getChild(Groups.Expr);
  if (!equal || !expr) return [{
    from: node.from, to: equal?.to ?? defNameNode.to, severity: "error", message: "Invalid variable declaration"
  }]

  const semicolon = node.getChild(Nodes.Semicolon);
  if (!semicolon) return [{
    from: node.from, to: expr.to, severity: "error", message: "The closing semicolon ';' is required",
    renderMessage: () => createElement("span", { innerHTML: "The closing semicolon <b>;</b> is required" })
  }]

  return [];
}

const noInvalidFunc = (state: EditorState, node: SyntaxNode): Diagnostic[] => {
  const callable = node.getChild(Groups.Expr);
  const def = getDefinition(state, callable);

  if (isUnknownType(def)) return [];
  if (def.type !== Kind.Func)
    return [{ from: callable.from, to: callable.to, severity: "error", message: "This expression is not callable" }]
  return [];
}

const noInvalidArgs = (state: EditorState, node: SyntaxNode): Diagnostic[] => {
  const def = getDefinition(state, node.getChild(Groups.Expr));
  if (def.type !== Kind.Func) return [];

  const nameNode = node.getChild(Groups.Expr);
  const funcName = state.sliceDoc(nameNode.from, nameNode.to);
  const argsNode = node.getChild(Nodes.Arguments);

  let args = argsNode.getChildren(Groups.Expr);
  if (node.parent && node.parent.type.is(Nodes.PipeExpr) && node.prevSibling) args = [node.parent.getChild(Groups.Expr), ...args];
  if (args.length === 0 && def.args.length === 0) return [];

  const required = def.args.filter(a => a.required ?? true).length;
  if (args.length < required) return [{
    from: argsNode.from, to: argsNode.to, severity: "error",
    message: `Expected ${required} arguments, but got ${args.length}`
  }];

  const finalArgIsVariadic = def.args[def.args.length - 1].variadic ?? false;
  if (args.length > def.args.length && !finalArgIsVariadic) return [{
    from: argsNode.from, to: argsNode.to, severity: "error",
    message: `Expected ${def.args.length} arguments, but got ${args.length}`
  }];

  const commas = argsNode.getChildren(Nodes.Comma);
  for (let comma of commas) {
    if (!comma.nextSibling || !comma.nextSibling.type.is(Groups.Expr)) return [{
      from: comma.from, to: comma.to, severity: "error", message: "Unexpected ','",
      renderMessage: () => createElement("span", { innerHTML: "Unexpected <b>,</b>" })
    }]
  }

  const argsDefs = args.map(arg => getDefinition(state, arg));
  const func = resolveFuncGenerics(def, argsDefs, funcName);

  for(let idx = 0; idx < argsDefs.length; idx++) {
    const arg = argsDefs[idx]
    if (isUnknownType(arg)) continue;

    let expected: Definition = idx < func.args.length ? func.args[idx]: func.args[func.args.length - 1];
    if (isPredicativeFunc(funcName) && expected.type === Kind.Func) expected = expected.returns[0];

    if (!isEquals(arg, expected)) return [{
      from: args[idx].from, to: args[idx].to, severity: "error",
      message: `Type '${toDetails(arg)}' is not assignable to type '${toDetails(expected)}'`,
      renderMessage: () => createElement("span", {
        innerHTML: `Type <b>${toDetails(arg)}</b> is not assignable to type <b>${toDetails(expected)}</b>`
      })
    }]
  }

  return [];
}

const noInvalidReturns = (state: EditorState, node: SyntaxNode): Diagnostic[] => {
  const def = getDefinition(state, node.getChild("Expr"));
  if (def.type !== Kind.Func) return [];

  if (def.returns.length === 1) return [];
  if (def.returns.length === 2)
    return [{
      from: node.from, to: node.to, severity: "warning",
      message: "The function returns two values.\nExpr will only use the first value, please note this.",
      renderMessage: () => createElement("span", {
        innerHTML: "The function returns two values.<br>Expr <b>will only use the first value</b>, please note this."
      })
    }];

  if (def.returns.length === 0) return [{
    from: node.from, to: node.to, severity: "error", message: "The function must return at least one value.",
    renderMessage: () => createElement("span", { innerHTML: "The function must return <b>at least one</b> value."})
  }]

  return [{
    from: node.from, to: node.to, severity: "error", message: "The function returns more than two values.",
    renderMessage: () => createElement("span", {
      innerHTML: "The function returns <b>more than two values</b>."
    })
  }];
}

const noInvalidBinaryOperation = (state: EditorState, node: SyntaxNode): Diagnostic[] => {
  const [leftNode, rightNode] = node.getChildren(Groups.Expr);
  const op = node.getChild(Groups.Op);
  if (!leftNode || !rightNode || !op) return [{
    from: node.from, to: node.to, severity: "error", message: "Invalid binary operation"
  }]

  const left = getDefinition(state, leftNode), right = getDefinition(state, rightNode);
  if (isUnknownType(left) || isUnknownType(right)) return [];

  switch (op.name) {
    case Nodes.CompareOp: {
      if (!isEquals(left, right)) return [{
        from: leftNode.from, to: rightNode.to, severity: "error",
        message: `mismatched types ${toDetails(left)} and ${toDetails(right)}`,
        renderMessage: () => createElement("span", {
          innerHTML: `mismatched types <b>${toDetails(left)}</b> and <b>${toDetails(right)}</b>`
        })
      }]

      const operand = state.doc.sliceString(op.from, op.to);
      if (operand === Operand.Equal || operand === Operand.NotEqual || isNumber(left)) return [];
      return [{
        from: leftNode.from, to: rightNode.to, severity: "error",
        message: `the operator '${operand}' is not defined on '${left.type}'`,
        renderMessage: () => createElement("span", {
          innerHTML: `the operator <b>${operand}</b> is not defined on <b>${left.type}</b>`
        })
      }]
      // break;
    }
    case Nodes.LogicOp: {
      const keyword = op.lastChild;
      if (keyword) {
        switch (keyword.name) {
          case Keywords.Contains: case Keywords.StartsWith: case Keywords.EndsWith: case Keywords.Matches: {
            let def = left, n = leftNode;
            if (def.type === Kind.String) { def = right; n = rightNode; }
            if (def.type !== Kind.String) return [{
              from: n.from, to: n.to, severity: "error", message: `mismatched types '${toDetails(def)}' and 'string'`,
              renderMessage: () => createElement("span", {
                innerHTML: `mismatched types <b>${toDetails(def)}</b> and <b>string</b>`
              })
            }]
            break;
          }
          case Keywords.In: {
            if (left.type === Kind.String) {
              if (right.type !== Kind.Array && right.type !== Kind.Slice && right.type !== Kind.Map) {
                if (right.type === Kind.String) return [{
                  from: rightNode.from, to: rightNode.to, severity: "error",
                  message: `Type '${toDetails(right)}' is not assignable to type 'array' or 'map'.`,
                  renderMessage: () => createElement("span", {
                    innerHTML: `Type <b>${toDetails(right)}</b> is not assignable to type <b>array</b> or <b>map</b>.<br />`
                  }),
                  actions: [{
                    name: "Replace 'in' with 'contains'",
                    apply: (view: EditorView) =>
                      view.dispatch({ changes: { from: keyword.from, to: keyword.to, insert: "contains" }})
                  }]
                }]

                return [{
                  from: rightNode.from, to: rightNode.to, severity: "error",
                  message: `Type '${toDetails(right)}' is not assignable to type 'array' or 'map'`,
                  renderMessage: () => createElement("span", {
                    innerHTML: `Type <b>${toDetails(right)}</b> is not assignable to type <b>array</b> or <b>map</b>`
                  })
                }]
              }
              if (right.type === Kind.Map) return
            }

            if (right.type !== Kind.Array && right.type !== Kind.Slice) return [{
              from: rightNode.from, to: rightNode.to, severity: "error",
              message: `Type ${toDetails(right)} is not assignable to type array`,
              renderMessage: () => createElement("span", {
                innerHTML: `Type <b>${toDetails(right)}</b> is not assignable to type <b>array</b>`
              })
            }]

            const item = right.item;
            if (!isEquals(left, item)) return [{
              from: leftNode.from, to: rightNode.to, severity: "error",
              message: `mismatched types '${toDetails(left)}' and array of '${toDetails(item)}'`,
              renderMessage: () => createElement("span", {
                innerHTML: `mismatched types <b>${toDetails(left)}</b> and array of <b>${toDetails(item)}</b>`
              })
            }]
          }
        }
        break;
      }

      const operand = state.doc.sliceString(op.from, op.to);
      if (operand === Operand.NilCoalescing) return [];

      if (!isEquals(left, right)) return [{
        from: leftNode.from, to: rightNode.to, severity: "error",
        message: `mismatched types '${toDetails(left)}' and '${toDetails(right)}'`,
        renderMessage: () => createElement("span", {
          innerHTML: `mismatched types <b>${toDetails(left)}</b> and <b>${toDetails(right)}</b>`
        })
      }]

      if (left.type !== Kind.Bool) return [{
        from: leftNode.from, to: rightNode.to, severity: "error",
        message: `the operator '${operand}' is not defined on '${toDetails(left)}'`,
        renderMessage: () => createElement("span", {
          innerHTML: `the operator <b>${operand}</b> is not defined on <b>${toDetails(left)}</b>`
        })
      }]
      break;
    }
    case Nodes.ArithmeticOp: {
      if (!isEquals(left, right)) return [{
        from: leftNode.from, to: rightNode.to, severity: "error",
        message: `mismatched types '${toDetails(left)}' and '${toDetails(right)}'`,
        renderMessage: () => createElement("span", {
          innerHTML: `mismatched types <b>${toDetails(left)}</b> and <b>${toDetails(right)}</b>`
        })
      }]

      const operand = state.doc.sliceString(op.from, op.to);
      if (operand === Operand.Cumulative && left.type === Kind.String) return [];
      if (isNumber(getBaseType(getScope(node), left))) return [];

      return [{
        from: leftNode.from, to: rightNode.to, severity: "error",
        message: `the operator '${operand}' is not defined on '${toDetails(left)}'`,
        renderMessage: () => createElement("span", {
          innerHTML: `the operator <b>${operand}</b> is not defined on <b>${toDetails(left)}</b>`
        })
      }]
    }
  }

  return [];
}

const noInvalidUnaryOperation = (state: EditorState, node: SyntaxNode): Diagnostic[] => {
  const op = node.getChild(Groups.Op);
  const expr = node.getChild(Groups.Expr);
  const def = getDefinition(state, expr);

  const operand = state.doc.sliceString(op.from, op.to);
  if ((operand === Operand.Not || operand === Operand.NotAlias) && def.type === Kind.Bool) return [];
  if ((operand === Operand.Subtract || operand === Operand.Cumulative) && isNumber(def)) return [];

  return [{ from: op.from, to: expr.to, severity: "error",  message: `Invalid operation: ${operand} ${def.type}`}]
}

const noUnknownField = (state: EditorState, node: SyntaxNode): Diagnostic[] => {
  if (!node.parent) return [];

  switch (node.parent.name) {
    case Nodes.PointerSelectorExpr: {
      const pointers = getPointers(state, node);
      if (!(Keywords.Pointer in pointers)) return [];

      const pointer = pointers[Keywords.Pointer], field = state.sliceDoc(node.from, node.to);
      if (pointer.type === Kind.Map || isUnknownType(pointer)) return [];

      const scope = getScope(node);
      const member = getMember(scope, resolveRef(scope, pointer), field);
      if (member !== null) return [];

      return [{
        from: node.from, to: node.to, severity: "error", markClass: "cm-undefined",
        message: `Property '${field}' does not exist on type '${toDetails(pointer)}'`,
        renderMessage: () => createElement("span", {
          innerHTML: `Property <b>${field}</b> does not exist on type <b>${toDetails(pointer)}</b>`
        })
      }];
    }
    case Nodes.SelectorExpr: case Nodes.OptionalSelectorExpr: {
      const source = getDefinition(state, node.parent.getChild("Expr")), field = state.sliceDoc(node.from, node.to);
      if (source.type === Kind.Map || isUnknownType(source)) return [];

      const scope = getScope(node);
      const member = getMember(scope, resolveRef(scope, source), field);
      if (member !== null) return [];

      return [{
        from: node.from, to: node.to, severity: "error", markClass: "cm-undefined",
        message: `Property '${field}' does not exist on type '${toDetails(source)}'`,
        renderMessage: () => createElement("span", {
          innerHTML: `Property <b>${field}</b> does not exist on type <b>${toDetails(source)}</b>`
        })
      }];
    }
  }

  return [];
}

const noInvalidSelector = (state: EditorState, node: SyntaxNode): Diagnostic[] => {
  const last = node.lastChild;
  if (last.name !== Nodes.FieldName) {
    const tail = state.sliceDoc(last.prevSibling.from, last.prevSibling.to);
    return [{
      from: node.to - tail.length, to: node.to, severity: "error",
      message: `Unexpected end of selector expression: '${tail}'`,
      renderMessage: () => createElement("span", {
        innerHTML: `Unexpected end of selector expression: <b>${tail}</b>`
      })
    }]
  }
  return [];
}

const noInvalidRange = (state: EditorState, node: SyntaxNode): Diagnostic[] => {
  const [startNode, endNode] = node.getChildren(Groups.Expr);
  if (!startNode || !endNode) return [{
    from: node.from, to: node.to, severity: "error", message: "Invalid range expression"
  }]

  const start = getDefinition(state, startNode), end = getDefinition(state, endNode);
  if (start.type === Kind.Int && end.type === Kind.Int) return [];

  return [{
    from: startNode.from, to: endNode.to, severity: "error",
    message: `Invalid range expression: ${toDetails(start)}..${toDetails(end)}`,
    renderMessage: () => createElement("span", {
      innerHTML: `Invalid range expression: <b>${toDetails(start)}</b>..<b>${toDetails(end)}</b>`
    })
  }]
}

const noInvalidSlice = (state: EditorState, node: SyntaxNode): Diagnostic[] => {
  const [src, start, end] = node.getChildren(Groups.Expr);
  if (!src) return [{ from: node.from, to: node.to, severity: "error", message: "Invalid slice expression" }]

  const source = getDefinition(state, src);
  if (source.type !== Kind.Array && source.type !== Kind.Slice) {
    return [{
      from: src.from, to: src.to, severity: "error",
      message: `Type '${toDetails(source)}' does not support slicing`,
      renderMessage: () => createElement("span", {
        innerHTML: `Type <b>${toDetails(source)}</b> does not support slicing`
      })
    }];
  }

  if (start) {
    const startType = getDefinition(state, start);
    if (startType.type !== Kind.Int) {
      const startValue = state.sliceDoc(start.from, start.to);
      return [{
        from: start.from, to: start.to, severity: "error",
        message: `Invalid slice start index '${startValue}' (the value must be representable by 'int' type)`,
        renderMessage: () => createElement("span", {
          innerHTML: `Invalid slice start index <b>${startValue}</b> (the value must be representable by <b>int</b> type)`
        })
      }];
    }
  }

  if (end) {
    const endType = getDefinition(state, end);
    if (endType.type !== Kind.Int) {
      const endValue = state.sliceDoc(end.from, end.to);
      return [{
        from: end.from, to: end.to, severity: "error",
        message: `Invalid slice end index '${endValue}' (the value must be representable by 'int' type)`,
        renderMessage: () => createElement("span", {
          innerHTML: `Invalid slice end index <b>${endValue}</b> (the value must be representable by <b>int</b> type)`
        })
      }];
    }
  }

  return [];
}

const noInvalidIndex = (state: EditorState, node: SyntaxNode): Diagnostic[] => {
  const [source, index] = node.getChildren(Groups.Expr);
  if (!source || !index) return [{ from: node.from, to: node.to, severity: "error", message: "Invalid index expression" }]

  const src = getDefinition(state, source), idx = getDefinition(state, index);
  if (isUnknownType(src)) return [];

  if (src.type !== Kind.Array && src.type !== Kind.Slice && src.type !== Kind.Map) return [{
    from: node.from, to: node.to, severity: "error", message: `Type '${src.type}' does not support indexing`,
    renderMessage: () => createElement("span", {
      innerHTML: `Type <b>${src.type}</b> does not support indexing`
    })
  }]

  if (isUnknownType(idx)) return [];
  if ((src.type === Kind.Array || src.type === Kind.Slice) && idx.type !== Kind.Int) {
    const idxValue = state.sliceDoc(index.from, index.to);
    return [{
      from: node.from, to: node.to, severity: "error",
      message: `Invalid array index '${idxValue}' (the value must be representable by 'int' type)`,
      renderMessage: () => createElement("span", {
        innerHTML: `Invalid array index <b>${idxValue}</b> (the value must be representable by <b>int</b> type`
      })
    }];
  }

  if (src.type === Kind.Map && idx.type !== Kind.String) {
    const idxValue = state.sliceDoc(index.from, index.to);
    return [{
      from: node.from, to: node.to, severity: "error",
      message: `'${idxValue}' (type ${idx.type}) cannot be represented by the type string`,
      renderMessage: () => createElement("span", {
        innerHTML: `<b>${idxValue}</b> (type <b>${idx.type}</b>) cannot be represented by the type <b>string</b>`
      })
    }]
  }

  return [];
}

const noInvalidPipe = (state: EditorState, node: SyntaxNode): Diagnostic[] => {
  const [source, func] = node.getChildren(Groups.Expr);
  if (!source || !func) return [{ from: node.from, to: node.to, severity: "error", message: "Invalid pipe expression" }]

  const def = getDefinition(state, func);
  if (!func.type.is(Nodes.CallExpr)) return [{
    from: func.prevSibling.from, to: func.to, severity: "error", message: "Invalid pipe expression"
  }]

  return [];
}

const rules = {
  [Nodes.VarDecl]: [noInvalidVarDeclaration,  noDeclareVarUsingBuiltinFunc, noRedeclareVar],
  [Nodes.VarName]: [noUnknownVar],
  [Nodes.Block]: [noUnusedBlock],
  [Nodes.String]: [noInvalidString],
  [Nodes.CallExpr]: [noInvalidFunc, noInvalidArgs, noInvalidReturns],
  [Nodes.BinaryExpr]: [noInvalidBinaryOperation],
  [Nodes.UnaryExpr]: [noInvalidUnaryOperation],
  [Nodes.FieldName]: [noUnknownField],
  [Nodes.SelectorExpr]: [noInvalidSelector],
  [Nodes.OptionalSelectorExpr]: [noInvalidSelector],
  [Nodes.RangeExpr]: [noInvalidRange],
  [Nodes.SliceExpr]: [noInvalidSlice],
  [Nodes.IndexExpr]: [noInvalidIndex],
  [Nodes.PipeExpr]: [noInvalidPipe],
}

export const lintNode = (state: EditorState, node: SyntaxNode): Diagnostic[] => {
  if (!(node.name in rules)) return [];

  for(let validator of rules[node.name]) {
    const diagnostic = validator(state, node);
    if (diagnostic.length > 0) return diagnostic;
  }

  return [];
}
