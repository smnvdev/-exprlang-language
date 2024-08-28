export enum Nodes {
  Expr = "Expr",

  DefName = "DefName", VarName = "VarName", FieldName = "FieldName",

  VarDecl = "VarDecl",

  Predicate = "Predicate",

  Number = "Number", Integer = "Integer", Float = "Float",
  Bool = "Bool", String = "String", Nil = "Nil",

  SelectorExpr = "SelectorExpr", OptionalSelectorExpr = "OptionalSelectorExpr",
  Pointer = "Pointer", PointerSelectorExpr = "PointerSelectorExpr",

  ParenthesizedExpr = "ParenthesizedExpr",

  Array = "Array", Map = "Map", Pair = "Pair",

  IndexExpr = "IndexExpr", SliceExpr = "SliceExpr", RangeExpr = "RangeExpr",
  CallExpr = "CallExpr", PipeExpr = "PipeExpr",

  UnaryExpr = "UnaryExpr", BinaryExpr = "BinaryExpr", ConditionalExpr = "ConditionalExpr",

  ArithmeticOp = "ArithmeticOp", CompareOp = "CompareOp", LogicOp = "LogicOp",
  Arguments = "Arguments",

  LineComment = "LineComment", BlockComment = "BlockComment", Block = "Block",

  Dot = ".", NilSelector = "?.", Semicolon = ";", Equals = "=", Comma = ",",
  OpenParen = "(", CloseParen = ")", OpenBracket = "[", CloseBracket = "]",
}

export enum Groups { Expr = "Expr", Op = "Op" }

export enum Keywords {
  Let = "let", Nil = "nil", True = "true", False = "false",

  Not = "not", In = "in",
  Contains = "contains", StartsWith = "startsWith", EndsWith = "endsWith", Matches = "matches",
  And = "and", Or = "or",

  Pointer = "#", Accumulator = "#acc",
  Env = "$env"
}

export enum Operand {
  Equal = "==", NotEqual = "!=", Less = "<", LessEqual = "<=", Greater = ">", GreaterEqual = ">=",
  NilCoalescing = "??", LogicalAnd = "&&", LogicalOr = "||",
  Cumulative = "+", Subtract = "-", Multiply = "*", Divide = "/", Modulo = "%",
  Not = "!", NotAlias = "not"
}