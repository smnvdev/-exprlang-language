import { EditorView, hoverTooltip } from "@codemirror/view"
import { syntaxTree} from "@codemirror/language";
import { highlightCode, Highlighter } from "@lezer/highlight";
import { SyntaxNode } from "@lezer/common";

import { exprLanguage } from "./expr";
import { getScope } from "./props";
import { Groups, Keywords, Nodes } from "./nodes";
import { getDefinition, getLocalScope, getMember, getPointers } from "./resolver";
import {
  FuncDefinition,
  Kind,
  ArgumentDefinition,
  Definition,
  builtIn,
  VariableDefinition,
  MethodDefinition,
  ExprKind
} from "./typing";


const createElement = (tag: string, attrs: {}): HTMLElement => {
  const node = document.createElement(tag);
  for (const key in attrs) node[key] = attrs[key];
  return node;
}

const renderType = (t: Definition): HTMLElement => {
  const e = document.createElement("span");

  switch (t.type) {
    case Kind.Pointer: e.append("*", renderType(t.to)); break;
    case Kind.Slice: e.append("[]", renderType(t.item)); break;
    case Kind.Array: e.append(
      "[", createElement("span", { className: "cm-token-number", textContent: t.size }) ,"]",
      renderType(t.item)
    ); break;
    case Kind.Channel: e.append(
      createElement("span", { className: "cm-token-keyword", textContent: "chan" }), renderType(t.item)
    ); break;
    case Kind.Map: e.append(
      createElement("span", { className: "cm-token-keyword", textContent: "map" }),
      "[", renderType(t.key), "]", renderType(t.value),
    ); break;
    case Kind.Func: e.append(
      createElement("span", { className: "cm-token-keyword", textContent: "func" }), renderFuncArgs(t)
    ); break;
    case Kind.Struct: {
      e.append(createElement("span", { className: "cm-token-keyword", textContent: "struct" }))
      if (t.fields && Object.keys(t.fields).length > 0) {
        const fields = createElement("div", { className: "cm-struct-fields" });
        Object.keys(t.fields).forEach((field) => {
          let name: Node = document.createTextNode(field);
          if ("name" in t && "package" in t)
            name = createElement("a", { href: `#/types/${t.package}.${t.name}/${field}`, textContent: field })

          if (t.fields[field].embedded ?? false) fields.append(renderType(t.fields[field]), document.createElement("span"));
          else fields.append(name, renderType(t.fields[field]));
        });
        e.append( " {", fields, "}");
      }
      break;
    }
    case Kind.Defined: return createElement("a", { href: `#/types/${t.typeName}`, textContent: t.typeName });
    case Kind.Generic: e.className = "cm-token-type"; e.textContent = "any"; break;
    case ExprKind.Optional: e.append("?", renderType(t.item)); break;
    default: e.className = "cm-token-type"; e.textContent = t.type; break;
  }

  return e;
}

const renderFuncArgs = (f: FuncDefinition): HTMLElement => {
  const e = document.createElement("span");
  e.append("(")

  const required = f.args.filter(a => a.required ?? true);
  required.forEach((arg, idx) => e.append(idx > 0 ? ", ": "", renderArg(arg)));

  const optional = f.args.filter(a => !(a.required ?? true));
  if (optional.length > 0) {
    const optionalArgs = createElement("span", { className: "cm-func-optional-args" })

    optionalArgs.append("[");
    optional.forEach((arg, idx) => optionalArgs.append((required.length > 0 || idx > 0) ? ", ": "", renderArg(arg)))
    optionalArgs.append("]");

    e.append(" ", optionalArgs);
  }
  e.append(") ")

  if (f.returns.length > 1) e.append("(")
  f.returns.map((r, idx) => e.append(idx > 0 ? ", ": "", renderType(r)));
  if (f.returns.length > 1) e.append(")")

  return e;
}

const renderArg = (a: ArgumentDefinition): HTMLElement => {
  const arg = document.createElement("span"), prefix = a.variadic ? "...": "";
  arg.append(prefix, createElement("span", { className: "cm-func-argument", textContent: a.name }), " ", renderType(a));
  return arg;
}

const render = (view: EditorView, node: SyntaxNode, path: string, highlighter: Highlighter | readonly Highlighter[]): HTMLElement => {
  const r = createElement("div", { id: "cm-tooltip-content", className: "cm-tooltip-content" });

  const msg = r.appendChild(createElement("div", { className: "cm-tooltip-message" }));
  const root = r.appendChild( createElement("div", { id: "cm-tooltip-documentation", className: "cm-tooltip-documentation" }))

  const def = root.appendChild(createElement("div", { className: "cm-tooltip-definition" }));

  const onClick = (e: MouseEvent) => {
    const to = (e.currentTarget as HTMLLinkElement).getAttribute("href");
    if (path != to) r.replaceWith(render(view, node, to, highlighter));

    e.preventDefault();
  }


  const scope = getScope(node);
  const content = root.appendChild(createElement("div", {className: "cm-tooltip-documentation-content" }));

  let description: string | HTMLElement | (() => string | HTMLElement);
  const [source, ...parts] = path.replace("#/", "").split("/");
  switch (source) {
    case "types": {
      const [name, member] = parts;

      let t: VariableDefinition | MethodDefinition = scope.types[name];
      if (t && member) t = getMember(scope, t, member)
      if (!t) return document.createElement("div");

      description = t.description;
      if (t.deprecated) msg.append(`'${member || name}' is deprecated`);

      if (!member) {
        const kw = createElement("span", { className: "cm-token-keyword", textContent: "type"});
        def.append(kw, ` ${t.name} `, renderType(t));
        break;
      }

      if ("receiver" in t) {
        const kw = createElement("span", { className: "cm-token-keyword", textContent: "func" });
        def.append(kw, " (", renderType(t.receiver),") ", member, renderFuncArgs(t))
        break;
      }

      const source = createElement("a", { href: `#/types/${name}`, textContent: name, onclick: onClick});
      const kw = createElement("span", { className: "cm-token-keyword", textContent: "type"});
      def.append("field ", member, " ", renderType(t), " of ",  source, " ", kw)
      break;
    }
    case "locals": {
      const [variable, ..._] = parts;

      let pos = node.from;
      if (node.type.is(Nodes.VarDecl)) pos = node.to + 1;
      if (node.type.is(Nodes.DefName)) pos = node.parent.to + 1;

      const s = getLocalScope(view.state, node, pos);
      if (!s[variable]) break;

      let t = s[variable].type !== Kind.Func ? s[variable]: {...s[variable], /*name: variable*/} as FuncDefinition;
      if (s[variable].type !== Kind.Func) {
        const textContent = variable.charAt(0) === "#" ? "pointer": "let";
        def.append(createElement("span", { className: "cm-token-keyword", textContent}), " ", variable, " ")
      }
      def.append(renderType(t)); description = s[variable].description;
      break;
    }
    case "variables": {
      const [variable, ..._] = parts;

      const t = getScope(node).variables[variable];
      if (!t) break;

      description = t.description;
      if (t.type === Kind.Func) {
        def.append(
          createElement("span", { className: "cm-token-keyword", textContent: "func" }), " ",
          variable, renderFuncArgs(t)
        )
        break;
      }

      def.append(
        createElement("span", { className: "cm-token-keyword", textContent: "env"}),
        " ", variable, " ", renderType(t)
      );
      break;
    }
  }

  if (description) {
    if (typeof description === "function") description = description();
    if (typeof description !== "string") content.appendChild(description);
    else content.innerHTML = description;
  }

  const highlighted = content.getElementsByClassName("highlighted");
  for(let idx = 0; idx < highlighted.length; idx++) {
    const input = highlighted[idx].textContent; highlighted[idx].textContent = "";
    highlightCode(input, exprLanguage.parser.parse(input),  highlighter,(code, className) => {
      const node = createElement("span", { className, textContent: code })
      if (code in builtIn.variables) node.className += " cm-builtin";
      highlighted[idx].appendChild(node);
      },
      () => highlighted[idx].appendChild(document.createElement("br"))
    )
  }

  const updateLinks = (links: HTMLCollectionOf<HTMLAnchorElement>) => {
    for (let idx = 0; idx < links.length; idx++) {
      const href = links[idx].getAttribute("href");
      if (href.charAt(0) === "#") links[idx].onclick = onClick
    }
  }

  updateLinks(content.getElementsByTagName("a"));
  updateLinks(def.getElementsByTagName("a"));

  return r;
}

export const hoverDocumentationExtension = (highlighter: Highlighter | readonly Highlighter[]) => hoverTooltip((v, pos, side) => {
  const node = syntaxTree(v.state).resolveInner(pos, -1);
  if (!node || !node.name) return;

  const getPath = (): string => {
    switch (node.name) {
      case Nodes.Pointer: return `locals/${v.state.sliceDoc(node.from, node.to)}`;
      case Nodes.DefName: return `locals/${v.state.sliceDoc(node.from, node.to)}`;
      case Nodes.VarDecl: {
        const def = node.getChild(Nodes.DefName);
        if (!def) break;

        const name = v.state.sliceDoc(def.from, def.to);
        return `locals/${name}`;
      }
      case Nodes.VarName: {
        const name = v.state.sliceDoc(node.from, node.to);

        if (name in getScope(node).variables) return `variables/${name}`;
        if (name in getLocalScope(v.state, node)) return `locals/${name}`;
        break;
      }
      case Nodes.FieldName: {
        if (!node.parent) break;

        let source: Definition;
        if (node.parent.type.is(Nodes.SelectorExpr) || node.parent.type.is(Nodes.OptionalSelectorExpr)) {
          source = getDefinition(v.state, node.parent.getChild(Groups.Expr));
        }

        if (node.parent.type.is(Nodes.PointerSelectorExpr)) {
          const pointers = getPointers(v.state, node);
          if (!(Keywords.Pointer in pointers)) break;
          source = pointers[Keywords.Pointer];
        }

        if (source && source.type === Kind.Defined) {
          const member = v.state.sliceDoc(node.from, node.to);
          return `types/${source.typeName}/${member}`;
        }
      }
    }
    return ""
  }

  const path = getPath();
  if (!path) return;

  return {
    pos: node.from, end: node.to,
    create(view) {
      document.getElementById("cm-tooltip-documentation")?.remove();
      const dom = render(view, node, path, highlighter);
      dom.id = "cm-tooltip-documentation-origin";
      return { dom }
    }
  }
}, {
  hideOnChange: true,
  hideOn: (tr, t) => {
    if (document.getElementById("cm-tooltip-documentation-origin")) return false;
    update(tr, "effects", []);
    return false
  }
});

function update(o: object, field: string, val: any) {
  o[field] = val;
  return o;
}