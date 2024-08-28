import { syntaxTree } from "@codemirror/language";
import { Decoration, EditorView, MatchDecorator, ViewPlugin, ViewUpdate } from "@codemirror/view";
import { RangeSet } from "@codemirror/state";

import { Nodes } from "./nodes";
import { getDefinition } from "./resolver";
import { builtIn, Deprecated } from "./typing";

const builtin = Decoration.mark({class: "cm-builtin"});
const deprecated = Decoration.mark({class: "cm-deprecated"});

const wordMatcher = new MatchDecorator({
  regexp: new RegExp(`[\\w$\xa1-\uffff][\\w$\\d\xa1-\uffff]*`, "g"),
  decoration: (match: RegExpExecArray, view: EditorView, pos: number) => {
    const node = syntaxTree(view.state).resolveInner(pos + match[0].length, -1);

    if (node.name === Nodes.VarName || node.name === Nodes.FieldName) {
      const t = getDefinition(view.state, node.name === Nodes.FieldName ? node.parent: node);
      if (t && "deprecated" in t && (t as Deprecated).deprecated) return deprecated
    }

    if (node.name === Nodes.VarName) {
      const func = view.state.sliceDoc(node.from, node.to);
      if (func in builtIn.variables) return builtin;
    }

    return null;
  }
})

class ExprPlugin {
  decoration: RangeSet<Decoration>;
  constructor(view: EditorView) { this.decoration = wordMatcher.createDeco(view); }
  update(update: ViewUpdate) {  this.decoration = wordMatcher.updateDeco(update, this.decoration); }
}

export const exprHighlights = ViewPlugin.fromClass(ExprPlugin, {
  decorations: instance => instance.decoration
})