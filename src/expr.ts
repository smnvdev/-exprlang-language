import { parser } from "@exprlang/parser";

import {
  LRLanguage, LanguageSupport,
  foldNodeProp, indentNodeProp,
  delimitedIndent,  foldInside,
} from "@codemirror/language";
import { SyntaxNode } from "@lezer/common";

import { exprHighlights } from "./builtin";
import {
  globalCompletionSource, localCompletionSource,
  selectorCompletionSource, binaryCompletionSource
} from "./complete";
import { buildScope, setScope } from "./props";
import { Scope } from "./typing";
import { Groups } from "./nodes";

export const useScope = (s?: Scope)  => setScope(buildScope(s));

export const exprLanguage = LRLanguage.define({
  name: "expr",
  parser: parser.configure({
    props: [
      indentNodeProp.add({ Block: delimitedIndent({closing: "}"}), BlockComment: () => null }),
      foldNodeProp.add({
        "Block Array Map ParenthesizedExpr": foldInside,
        Arguments(node, s){
          const isMultiline = (node: SyntaxNode) => {
            return s.doc.lineAt(node.from).number != s.doc.lineAt(node.to).number
          }

          let counter = 0;
          let prev = node.firstChild
          for (const child of node.getChildren(Groups.Expr)) {
            counter += isMultiline(child) ? 1 : 0;
            if (counter > 1 || s.doc.lineAt(prev.to).number != s.doc.lineAt(child.from).number) return foldInside(node);
            prev = child
          }
          return null;
        },
        BlockComment: (tree) => ({ from: tree.from + 2, to: tree.to - 2 })
      }),
    ]
  }),
  languageData: {
    closeBrackets: { brackets: ["(", "[", "{", "'", '"', "`"] },
    commentTokens: { line: "//", block: {open: "/*", close: "*/"} }
  }
})


export function expr() {
  return new LanguageSupport(exprLanguage, [
    exprHighlights,
    exprLanguage.data.of({ autocomplete: globalCompletionSource }),
    exprLanguage.data.of({ autocomplete: localCompletionSource }),
    exprLanguage.data.of({ autocomplete: binaryCompletionSource }),
    exprLanguage.data.of({ autocomplete: selectorCompletionSource }),
  ]);
}