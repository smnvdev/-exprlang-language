export enum Kind {
  Int8 = "int8", Uint8 = "uint8", Int16 = "int16", Uint16 = "uint16",
  Int32 = "int32", Uint32 = "uint32", Int64 = "int64", Uint64 = "uint64",
  Int = "int", Uint = "uint", Uintptr = "uintptr",

  Float32 = "float32", Float64 = "float64",

  Complex64 = "complex64", Complex128 = "complex128",

  Bool = "bool", String = "string", Byte = "byte", Rune = "rune",

  Array = "array", Slice = "slice", Map = "map", Func = "func", Struct = "struct",

  Pointer = "pointer", Channel = "chan",
  Interface = "interface", Error = "error", Any = "any", Nil = "nil",

  Generic = "generic", Defined = "defined"
}

export enum ExprKind { Number = "number", Float = "float", Optional = "optional" }

type Type<T extends Kind | ExprKind> = { type: T };

type Name = { name: string };
type Description = { description?: string | HTMLElement | (() => HTMLElement | string) };
export type Deprecated = { deprecated?: /* by default "false" */ boolean };
type Generics = Record<string, Definition[]>;

export type VariableDefinition = Definition & Description & Name & Deprecated;
export type ArgumentDefinition = Definition & Description & Name & {
  required?: /* by default "true" */ boolean, variadic?: /* by default "false" */ boolean
};

export type MethodDefinition = FuncDefinition & Description & Name & Deprecated & {
  receiver: DefinedType | Type<Kind.Pointer> & { to: DefinedType }
}
export type TypeDefinition   = Exclude<Definition, GenericDefinition> & Description & Name & Deprecated & {
  package?: string, methods?: Record<string, MethodDefinition> };

export type Item    = { item: Definition };

export type DefinedType       = Type<Kind.Defined> & { typeName: string };
export type SliceDefinition   = Type<Kind.Slice>   & { item: Definition; };
export type ArrayDefinition   = Type<Kind.Array>   & { size: number, item: Definition; };
export type MapDefinition     = Type<Kind.Map>     & { key: Definition; value: Definition; };
export type FuncDefinition    = Type<Kind.Func>    & { generics?: Generics, args: ArgumentDefinition[], returns: Definition[] };

export type FieldDefinition   = VariableDefinition & { embedded?: /* by default "false" */ boolean };
export type StructDefinition  = Type<Kind.Struct>  & { fields: Record<string, FieldDefinition> };
export type PointerDefinition = Type<Kind.Pointer> & { to: Definition };
export type ChannelDefinition = Type<Kind.Channel> & { item: Definition };

export type GenericDefinition = Type<Kind.Generic> & { generic: string };

export type OptionalDefinition = Type<ExprKind.Optional> & { item: Definition };

export type Definition =
  Type<Kind.Int8> | Type<Kind.Uint8> | Type<Kind.Int16> | Type<Kind.Uint16> |
  Type<Kind.Int32> | Type<Kind.Uint32> | Type<Kind.Int64> | Type<Kind.Uint64> |
  Type<Kind.Int> | Type<Kind.Uint> | Type<Kind.Uintptr> |

  Type<Kind.Float32> | Type<Kind.Float64> |

  Type<Kind.Complex64> | Type<Kind.Complex128> |

  Type<Kind.Bool> | Type<Kind.String> | Type<Kind.Byte> | Type<Kind.Rune> |

  SliceDefinition | ArrayDefinition | MapDefinition | FuncDefinition | StructDefinition |
  PointerDefinition | ChannelDefinition |

  Type<Kind.Interface> | Type<Kind.Error> | Type<Kind.Any> | Type<Kind.Nil> |

  Type<ExprKind.Number> | Type<ExprKind.Float> | OptionalDefinition |

  GenericDefinition | DefinedType;

export interface Scope {
  variables: Record<string, VariableDefinition>;
  types: Record<string, TypeDefinition>;
}

export const builtIn: Scope = {
  variables: {
    "$env": {
      name: "$env",
      description: "<p>The <code>$env</code> variable is a map of all variables passed to the expression.</p>" +
        "<div class='example'><div class='title'>Example</div><div class='code'>" +
        "<span class='highlighted'>foo.Name == $env[\"foo\"].Name\n</span></br>" +
        "<span class='highlighted'>$env[\"var with spaces\"]</span></div></div>" +
        "<p>Think of <code>$env</code> as a global variable that contains all variables.</p>" +
        "<p>The <code>$env</code> can be used to check if a variable is defined:</p>"  +
        "<div class='example'><div class='title'>Example</div><div class='code'>" +
        "<span class='highlighted'>'foo' in $env</span></div></div>",

      type: Kind.Map, key: { type: Kind.String }, value: { type: Kind.Any },
    },

    /* [String Functions](https://expr-lang.org/docs/language-definition#string-functions) */
    trim: {
      name: "trim",
      description: "<p>Removes white spaces from both ends of a string <code>str</code>. " +
        "If the optional <code>chars</code> argument is given, it is a string specifying the set " +
        "of characters to be removed.</p>" +
        "<div class='example'><div class='title'>Example</div><div class='code'>" +
        "<span class='highlighted'>trim(\"  Hello  \") == \"Hello\"</span></br>" +
        "<span class='highlighted'>trim(\"__Hello__\", \"_\") == \"Hello\"</span></div></div>",

      type: Kind.Func, args: [{ name: "str", type: Kind.String }, { name: "chars", type: Kind.String, required: false }],
      returns: [{ type: Kind.String }],
    },
    trimPrefix: {
      name: "trimPrefix",
      description: "<p>Removes the specified prefix from the string <code>str</code> if it starts with that prefix.</p>" +
        "<div class='example'><div class='title'>Example</div><div class='code'>" +
        "<span class='highlighted'>trimPrefix(\"HelloWorld\", \"Hello\") == \"World\"</span></div></div>",

      type: Kind.Func, args: [{ name: "str", type: Kind.String }, { name: "prefix", type: Kind.String }],
      returns: [{ type: Kind.String }]
    },
    trimSuffix: {
      name: "trimSuffix",
      description: "<p>Removes the specified suffix from the string <code>str</code> if it ends with that suffix.</p>" +
        "<div class='example'><div class='title'>Example</div><div class='code'>" +
        "<span class='highlighted'>trimSuffix(\"HelloWorld\", \"World\") == \"Hello\"</span></div></div>",

      type: Kind.Func, args: [{ name: "str", type: Kind.String }, { name: "suffix", type: Kind.String }],
      returns: [{ type: Kind.String }]
    },
    upper: {
      name: "upper",
      description: "<p>Converts all the characters in string <code>str</code> to uppercase.</p>" +
        "<div class='example'><div class='title'>Example</div><div class='code'>" +
        "<span class='highlighted'>upper(\"hello\") == \"HELLO\"</span></div></div>",

      type: Kind.Func, args: [{ name: "str", type: Kind.String }], returns: [{ type: Kind.String }]
    },
    lower: {
      name: "lower",
      description: "<p>Converts all the characters in string <code>str</code> to lowercase.</p>" +
        "<div class='example'><div class='title'>Example</div><div class='code'>" +
        "<span class='highlighted'>lower(\"HELLO\") == \"hello\"</span></div></div>",
      type: Kind.Func, args: [{ name: "str", type: Kind.String }], returns: [{ type: Kind.String }]
    },
    split: {
      name: "split",
      description: "<p>Splits the string <code>str</code> at each instance of the delimiter and returns an array of substrings.</p>" +
        "<div class='example'><div class='title'>Example</div><div class='code'>" +
        "<span class='highlighted'>split(\"apple,orange,grape\", \",\") == [\"apple\", \"orange\", \"grape\"]</span></br>" +
        "<span class='highlighted'>split(\"apple,orange,grape\", \",\", 2) == [\"apple\", \"orange,grape\"]</span></div></div>",

      type: Kind.Func, args: [
        { name: "str", type: Kind.String },
        { name: "delimiter", type: Kind.String },
        { name: "n", required: false, type: Kind.Int }
      ],
      returns: [{ type: Kind.Slice, item: { type: Kind.String } }]
    },
    splitAfter: {
      name: "splitAfter",
      description: "<p>Splits the string <code>str</code> after each instance of the delimiter.</p>" +
        "<div class='example'><div class='title'>Example</div><div class='code'>" +
        "<span class='highlighted'>splitAfter(\"apple,orange,grape\", \",\") == [\"apple,\", \"orange,\", \"grape\"]</span></br>" +
        "<span class='highlighted'>splitAfter(\"apple,orange,grape\", \",\", 2) == [\"apple,\", \"orange,grape\"]</span></div></div>",

      type: Kind.Func, args: [
        { name: "str", type: Kind.String },
        { name: "delimiter", type: Kind.String },
        { name: "n", required: false, type: Kind.Int }
      ],
      returns: [{ type: Kind.Slice, item: { type: Kind.String }}]
    },
    replace: {
      name: "replace",
      description: "<p>Replaces all occurrences of <code>old</code> in string <code>str</code> with <code>new</code>.</p>" +
        "<div class='example'><div class='title'>Example</div><div class='code'>" +
        "<span class='highlighted'>replace(\"Hello World\", \"World\", \"Universe\") == \"Hello Universe\"</span></div></div>",

      type: Kind.Func,
      args: [{ name: "str", type: Kind.String }, { name: "old", type: Kind.String }, { name: "new", type: Kind.String }],
      returns: [{ type: Kind.String }]
    },
    repeat: {
      name: "repeat",
      description: "<p>Repeats the string <code>str</code> <code>n</code> times.</p>" +
        "<div class='example'><div class='title'>Example</div><div class='code'>" +
        "<span class='highlighted'>repeat(\"Hi\", 3) == \"HiHiHi\"</span></div></div>",

      type: Kind.Func, args: [{ name: "str", type: Kind.String }, { name: "n", type: Kind.Int }],
      returns: [{ type: Kind.String }]
    },
    indexOf: {
      name: "indexOf",
      description: "<p>Returns the index of the first occurrence of the substring in string " +
        "<code>str</code> or <code>-1</code> if not found.</p>" +
        "<div class='example'><div class='title'>Example</div><div class='code'>" +
        "<span class='highlighted'>indexOf(\"apple pie\", \"pie\") == 6</span></div></div>",

      type: Kind.Func, args: [{ name: "str", type: Kind.String }, { name: "substring", type: Kind.String }],
      returns: [{ type: Kind.Int }]
    },
    lastIndexOf: {
      name: "lastIndexOf",
      description: "<p>Returns the index of the last occurrence of the substring in string " +
        "<code>str</code> or <code>-1</code> if not found.</p>" +
        "<div class='example'><div class='title'>Example</div><div class='code'>" +
        "<span class='highlighted'>lastIndexOf(\"apple pie apple\", \"apple\") == 10</span></div></div>",

      type: Kind.Func, args: [{ name: "str", type: Kind.String }, { name: "substring", type: Kind.String }],
      returns: [{ type: Kind.Int }]
    },
    hasPrefix: {
      name: "hasPrefix",
      description: "<p>Returns <code>true</code> if string <code>str</code> starts with the given prefix.</p>" +
        "<div class='example'><div class='title'>Example</div><div class='code'>" +
        "<span class='highlighted'>hasPrefix(\"HelloWorld\", \"Hello\") == true</span></div></div>",

      type: Kind.Func, args: [{ name: "str", type: Kind.String }, { name: "prefix", type: Kind.String }],
      returns: [{ type: Kind.Bool }]
    },
    hasSuffix: {
      name: "hasSuffix",
      description: "<p>Returns <code>true</code> if string <code>str</code> ends with the given suffix.</p>" +
        "<div class='example'><div class='title'>Example</div><div class='code'>" +
        "<span class='highlighted'>hasSuffix(\"HelloWorld\", \"World\") == true</span></div></div>",

      type: Kind.Func, args: [{ name: "str", type: Kind.String }, { name: "suffix", type: Kind.String }],
      returns: [{ type: Kind.Bool }]
    },
    /* [Date Functions](https://expr-lang.org/docs/language-definition#date-functions) */
    now: {
      name: "now",
      description: () => {
        return "<p>Returns the current date as a <a href='time.Time'>time.Time</a> value.</p>" +
          "<div class='example'><div class='title'>Example</div><div class='code'>" +
          "<span class='highlighted'>now().Year() == " + new Date().getFullYear() + "</span></div></div>";
      },

      type: Kind.Func, args: [], returns: [{ type: Kind.Defined, typeName: "time.Time" }]
    },
    duration: {
      name: "duration",
      description: "<p>Returns <a href='time.Duration'>time.Duration</a> value of the given string <code>str</code>.</p>" +
        "<p>Valid time units are \"ns\", \"us\" (or \"µs\"), \"ms\", \"s\", \"m\", \"h\".</p>" +
        "<div class='example'><div class='title'>Example</div><div class='code'>" +
        "<span class='highlighted'>duration(\"1h\").Seconds() == 3600</span></div></div>",

      type: Kind.Func, args: [{ name: "str", type: Kind.String }],
      returns: [{ type: Kind.Defined, typeName: "time.Duration" }]
    },
    date: {
      name: "date",
      description: "<p>Converts the given string <code>str</code> into a date representation.</p>" +
        "<p>If the optional <code>format</code> argument is given, it is a string specifying the format of the date. " +
        "The format string uses the same formatting rules as the standard Go " +
        "<a href='https://pkg.go.dev/time#pkg-constants' target='_blank'>time package.</a></p>" +
        "<p>If the optional <code>timezone</code> argument is given, it is a string specifying the timezone of the date.</p>" +
        "<p>If the <code>format</code> argument is not given, the <code>v</code> argument must be in one of the following formats:" +
        "<ul><li>2006-01-02</li><li>15:04:05</li><li>2006-01-02 15:04:05</li><li>RFC3339</li>" +
        "<li>RFC822</li><li>RFC850</li><li>RFC1123</li></ul></p>" +
        "<div class='example'><div class='title'>Example</div><div class='code'>" +
        "<span class='highlighted'>date(\"2023-08-14\")</span></br>" +
        "<span class='highlighted'>date(\"15:04:05\")</span></br>" +
        "<span class='highlighted'>date(\"2023-08-14T00:00:00Z\")</span></br>" +
        "<span class='highlighted'>date(\"2023-08-14 00:00:00\", \"2006-01-02 15:04:05\", \"Europe/Zurich\")</span></div></div>",

      type: Kind.Func, args: [
        { name: "str", type: Kind.String },
        { name: "format", required: false, type: Kind.String },
        { name: "timezone", required: false, type: Kind.String}
      ],
      returns: [{ type: Kind.Defined, typeName: "time.Time" }]
    },
    timezone: {
      name: "timezone",
      description: "<p>Returns the timezone of the given string <code>str</code>. List of available timezones can be found " +
        "<a href='https://en.wikipedia.org/wiki/List_of_tz_database_time_zones' target='_blank'>here</a>.</p>" +
        "<div class='example'><div class='title'>Example</div><div class='code'>" +
        "<span class='highlighted'>timezone(\"Europe/Zurich\")</span></br>" +
        "<span class='highlighted'>timezone(\"UTC\")</span></div></div>",

      type: Kind.Func, args: [{ name: "str", type: Kind.String }],
      returns: [{ type: Kind.Defined, typeName: "time.Location" }]
    },
    /* [Number Functions](https://expr-lang.org/docs/language-definition#number-functions) */
    max: {
      name: "max",
      description: "<p>Returns the maximum of the two numbers <code>n1</code> and <code>n2</code>.</p>" +
        "<div class='example'><div class='title'>Example</div><div class='code'>" +
        "<span class='highlighted'>max(5, 7) == 7</span></div></div>",

      type: Kind.Func, args: [{ name: "n1", type: ExprKind.Number}, { name: "n2", type: ExprKind.Number }],
      returns: [{ type: ExprKind.Number }]
    },
    min: {
      name: "min",
      description: "<p>Returns the minimum of the two numbers <code>n1</code> and <code>n2</code>.</p>" +
        "<div class='example'><div class='title'>Example</div><div class='code'>" +
        "<span class='highlighted'>min(5, 7) == 5</span></div></div>",

      type: Kind.Func, args: [{ name: "n1", type: ExprKind.Number}, { name: "n2", type: ExprKind.Number }],
      returns: [{ type: ExprKind.Number }]
    },
    abs: {
      name: "abs",
      description: "<p>Returns the absolute value of a number.</p>" +
        "<div class='example'><div class='title'>Example</div><div class='code'><span class='highlighted'>abs(-5) == 5</span></div></div>",

      type: Kind.Func, args: [{ name: "n", type: ExprKind.Number}], returns: [{ type: ExprKind.Number }]
    },
    ceil: {
      name: "ceil",
      description: "<p>Returns the least integer value greater than or equal to <code>n</code>.</p>" +
        "<div class='example'><div class='title'>Example</div><div class='code'><span class='highlighted'>ceil(1.5) == 2.0</span></div></div>",

      type: Kind.Func, args: [{ name: "n", type: ExprKind.Number }],  returns: [{ type: ExprKind.Float }]
    },
    floor: {
      name: "floor",
      description: "<p>Returns the greatest integer value less than or equal to <code>n</code>.</p>" +
        "<div class='example'><div class='title'>Example</div><div class='code'><span class='highlighted'>floor(1.5) == 1.0</span></div></div>",

      type: Kind.Func, args: [{ name: "n", type: ExprKind.Number }], returns: [{ type: ExprKind.Float }]
    },
    round: {
      name: "round",
      description: "<p>Returns the nearest integer, rounding half away from zero.</p>" +
        "<div class='example'><div class='title'>Example</div><div class='code'><span class='highlighted'>round(1.5) == 2.0</span></div></div>",

      type: Kind.Func, args: [{ name: "n", type: ExprKind.Number}], returns: [{ type: ExprKind.Float }]
    },
    /* [Array Functions](https://expr-lang.org/docs/language-definition#array-functions)) */
    all: {
      name: "all",
      description: "<p>Returns <code>true</code> if all elements satisfies the " +
        "<a href='https://expr-lang.org/docs/language-definition#predicate' target='_blank'>predicate</a>. " +
        "If the array is empty, returns <code>true</code>.</p><div class='example'><div class='title'>Example</div><div class='code'>" +
        "<span class='highlighted'>all(tweets, {.Size < 280})</span></div></div>",

      type: Kind.Func, generics: { T: [{ type: Kind.Any }] }, args: [
        { name: "array", type: Kind.Slice, item: { type: Kind.Generic, generic: "T" } },
        { name: "predicate", type: Kind.Func, args: [{ name: "#", type: Kind.Generic, generic: "T" }], returns: [{type: Kind.Bool}] }
      ],
      returns: [{ type: Kind.Bool }]
    },
    any: {
      name: "any",
      description: "<p>Returns <code>true</code> if any element satisfies the " +
        "<a href='https://expr-lang.org/docs/language-definition#predicate' target='_blank'>predicate</a>. " +
        "If the array is empty, returns <code>false</code>.</p><div class='example'><div class='title'>Example</div><div class='code'>" +
        "<span class='highlighted'>any(tweets, {.Size > 280})</span></div></div>",

      type: Kind.Func, generics: { T: [{ type: Kind.Any }] }, args: [
        { name: "array", type: Kind.Slice, item: { type: Kind.Generic, generic: "T" } },
        { name: "predicate", type: Kind.Func, args: [{name: "#", type: Kind.Generic, generic: "T" }], returns: [{type: Kind.Bool}] }
      ],
      returns: [{ type: Kind.Bool }]
    },
    one: {
      name: "one",
      description: "<p>Returns <code>true</code> if exactly one element satisfies the " +
        "<a href='https://expr-lang.org/docs/language-definition#predicate' target='_blank'>predicate</a>. " +
        "If the array is empty, returns <code>false</code>.</p><div class='example'><div class='title'>Example</div><div class='code'>" +
        "<span class='highlighted'>one(participants, {.Winner})</span></div></div>",

      type: Kind.Func, generics: { T: [{ type: Kind.Any }] }, args: [
        { name: "array", type: Kind.Slice, item: { type: Kind.Generic, generic: "T" } },
        { name: "predicate", type: Kind.Func, args: [{name: "#", type: Kind.Generic, generic: "T"}], returns: [{type: Kind.Bool}] }
      ],
      returns: [{ type: Kind.Bool }]
    },
    none: {
      name: "none",
      description: "<p>Returns <code>true</code> if all elements does not satisfy the " +
        "<a href='https://expr-lang.org/docs/language-definition#predicate' target='_blank'>predicate</a>. " +
        "If the array is empty, returns <code>true</code>.</p><div class='example'><div class='title'>Example</div><div class='code'>" +
        "<span class='highlighted'>none(tweets, {.Size > 280})</span></div></div>",

      type: Kind.Func, generics: { T: [{ type: Kind.Any }] }, args: [
        { name: "array", type: Kind.Slice, item: { type: Kind.Generic, generic: "T" } },
        { name: "predicate", type: Kind.Func,  args: [{name: "#", type: Kind.Generic, generic: "T"}], returns: [{type: Kind.Bool}] }
      ],
      returns: [{ type: Kind.Bool }]
    },
    map: {
      name: "map",
      description: "<p>Returns new array by applying the " +
        "<a href='https://expr-lang.org/docs/language-definition#predicate' target='_blank'>predicate</a> " +
        "to each element of the array.</p>" +
        "<div class='example'><div class='title'>Example</div><div class='code'><span class='highlighted'>map(tweets, {.Size})</span></div></div>",

      type: Kind.Func, generics: { T: [{ type: Kind.Any }], R: [{ type: Kind.Any }] }, args: [
        { name: "array", type: Kind.Slice, item: { type: Kind.Generic, generic: "T" } },
        { name: "predicate",
          type: Kind.Func, args: [{ name: "#index", type: Kind.Int }, { name: "#", type: Kind.Generic, generic: "T" }], returns: [{ type: Kind.Generic, generic: "R" }],
        }
      ],
      returns: [{type: Kind.Slice, item: { type: Kind.Generic, generic: "R" } }]
    },
    filter: {
      name: "filter",
      description: "<p>Returns new array by filtering elements of the array by " +
        "<a href='https://expr-lang.org/docs/language-definition#predicate' target='_blank'>predicate</a>.</p>" +
        "<div class='example'><div class='title'>Example</div><div class='code'>" +
        "<span class='highlighted'>filter(users, .Name startsWith \"J\")</span></div></div>",

      type: Kind.Func, generics: { T: [{ type: Kind.Any }] }, args: [
        { name: "array", type: Kind.Slice, item: { type: Kind.Generic, generic: "T" } },
        { name: "predicate", type: Kind.Func, args: [{ name: "#", type: Kind.Generic, generic: "T" }], returns: [{ type: Kind.Bool}] }
      ],
      returns: [{ type: Kind.Slice, item: { type: Kind.Generic, generic: "T" }}]
    },
    find: {
      name: "find",
      description: "<p>Finds the first element in an array that satisfies the " +
        "<a href='https://expr-lang.org/docs/language-definition#predicate' target='_blank'>predicate</a>.</p>" +
        "<div class='example'><div class='title'>Example</div><div class='code'>" +
        "<span class='highlighted'>find([1, 2, 3, 4], # > 2) == 3</span></div></div>",

      type: Kind.Func, generics: {T: [{ type: Kind.Any }]},
      args: [
        { name: "array", type: Kind.Slice, item: { type: Kind.Generic, generic: "T" } },
        { name: "predicate", type: Kind.Func,  args: [{ name: "#", type: Kind.Generic, generic: "T" }], returns: [{ type: Kind.Bool}] }
      ],
      returns: [{ type: ExprKind.Optional, item: { type: Kind.Generic, generic: "T" }}]
    },
    findIndex: {
      name: "findIndex",
      description: "<p>Finds the index of the first element in an array that satisfies the " +
        "<a href='https://expr-lang.org/docs/language-definition#predicate' target='_blank'>predicate</a>.</p>" +
        "<div class='example'><div class='title'>Example</div><div class='code'>" +
        "<span class='highlighted'>findIndex([1, 2, 3, 4], # > 2) == 2</span></div></div>",

      type: Kind.Func, generics: {T: [{ type: Kind.Any }]}, args: [
        { name: "array", type: Kind.Slice, item: { type: Kind.Generic, generic: "T" } },
        { name: "predicate", type: Kind.Func, args: [{ name: "#", type: Kind.Generic, generic: "T" }], returns: [{ type: Kind.Bool }] }
      ],
      returns: [{ type: ExprKind.Optional, item: { type: Kind.Int }}]
    },
    findLast: {
      name: "findLast",
      description: "<p>Finds the last element in an array that satisfies the " +
        "<a href='https://expr-lang.org/docs/language-definition#predicate' target='_blank'>predicate</a>.</p>" +
        "<div class='example'><div class='title'>Example</div><div class='code'>" +
        "<span class='highlighted'>findLast([1, 2, 3, 4], # > 2) == 4</span></div></div>",

      type: Kind.Func, generics: {T: [{ type: Kind.Any }]}, args: [
        { name: "array", type: Kind.Slice, item: { type: Kind.Generic, generic: "T" } },
        { name: "predicate", type: Kind.Func, args: [{ name: "#", type: Kind.Generic, generic: "T" }], returns: [{ type: Kind.Bool}] }
      ],
      returns: [{ type: ExprKind.Optional, item: { type: Kind.Generic, generic: "T" }}]
    },
    findLastIndex: {
      name: "findLastIndex",
      description: "<p>Finds the index of the last element in an array that satisfies the " +
        "<a href='https://expr-lang.org/docs/language-definition#predicate' target='_blank'>predicate</a>.</p>" +
        "<div class='example'><div class='title'>Example</div><div class='code'>" +
        "<span class='highlighted'>findLastIndex([1, 2, 3, 4], # > 2) == 3</span></div></div>",

      type: Kind.Func, generics: {T: [{ type: Kind.Any }]}, args: [
        { name: "array", type: Kind.Slice, item: { type: Kind.Generic, generic: "T" } },
        { name: "predicate", type: Kind.Func, args: [{ name: "#", type: Kind.Generic, generic: "T" }], returns: [{ type: Kind.Bool}] }
      ],
      returns: [{ type: ExprKind.Optional, item: { type: Kind.Int }}]
    },
    groupBy: {
      name: "groupBy",
      description: "<p>Groups the elements of an array by the result of the " +
        "<a href='https://expr-lang.org/docs/language-definition#predicate' target='_blank'>predicate</a>.</p>" +
        "<div class='example'><div class='title'>Example</div><div class='code'>" +
        "<span class='highlighted'>groupBy(users, .Age)</span></div></div>",

      type: Kind.Func, generics: {T: [{ type: Kind.Any }], R: [{ type: Kind.Any }]}, args: [
        { name: "array", type: Kind.Slice, item: { type: Kind.Generic, generic: "T" } },
        { name: "predicate", type: Kind.Func, args: [{ name: "#", type: Kind.Generic, generic: "T" }], returns: [{ type: Kind.Generic, generic: "R" }] }
      ],
      returns: [{ type: Kind.Map, key: { type: Kind.Generic, generic: "R" }, value: { type: Kind.Slice, item: { type: Kind.Generic, generic: "T" } }}]
    },
    count: {
      name: "count",
      description: "<p>Returns the number of elements what satisfies the " +
        "<a href='https://expr-lang.org/docs/language-definition#predicate' target='_blank'>predicate</a>.</p>" +
        "<div class='example'><div class='title'>Example</div><div class='code'>" +
        "<span class='highlighted'>count(users, .Age > 18)</span></div></div>" +
        "<div class='example'><div class='title'>Equivalent to</div><div class='code'>" +
        "<span class='highlighted'>len(filter(users, .Age > 18))</span></div></div>" +
        "<p>If the predicate is not given, returns the number of <code>true</code> elements in the array.</p>" +
        "<div class='example'><div class='title'>Example</div><div class='code'>" +
        "<span class='highlighted'>count([true, false, true]) == 2</span></div></div>",

      type: Kind.Func, generics: {T: [{ type: Kind.Any }]}, args: [
        { name: "array", type: Kind.Slice, item: { type: Kind.Generic, generic: "T" } },
        { name: "predicate", type: Kind.Func, args: [{ name: "#", type: Kind.Generic, generic: "T" }], returns: [{ type: Kind.Bool}]}
      ],
      returns: [{ type: Kind.Int }]
    },
    concat: {
      name: "concat",
      description: "<p>Concatenates two or more arrays.</p>" +
        "<div class='example'><div class='title'>Example</div><div class='code'>" +
        "<span class='highlighted'>concat([1, 2], [3, 4]) == [1, 2, 3, 4]</span></div></div>",

      type: Kind.Func, args: [
        { name: "array1", type: Kind.Slice, item: { type: Kind.Any } },
        { name: "array2", type: Kind.Slice, item: { type: Kind.Any } },
        {
          name: "other", required: false, variadic: true,
          type: Kind.Slice, item: { type: Kind.Slice, item: { type: Kind.Any } }
        },
      ],
      returns: [{ type: Kind.Slice, item: { type: Kind.Any }}]
    },
    join: {
      name: "join",
      description: "<p>Joins an array of strings into a single string with the given <code>delimiter</code>. " +
        "If no <code>delimiter</code> is given, an empty string is used.</p>" +
        "<div class='example'><div class='title'>Example</div><div class='code'>" +
        "<span class='highlighted'>join([\"apple\", \"orange\", \"grape\"], \",\") == \"apple,orange,grape\"</span></br>" +
        "<span class='highlighted'>join([\"apple\", \"orange\", \"grape\"]) == \"appleorangegrape\"</span></div></div>",

      type: Kind.Func, args: [
        { name: "array", type: Kind.Slice, item: { type: Kind.String } },
        { name: "delimiter", type: Kind.String, required: false }
      ],
      returns: [{ type: Kind.String }]
    },
    reduce: {
      name: "reduce",
      description: "<p>Applies a predicate to each element in the array, reducing the array to a single value. " +
        "Optional <code>initialValue</code> argument can be used to specify the initial value of the accumulator." +
        "If <code>initialValue</code> is not given, the first element of the array is used as the initial value.</p>" +
        "<p>Following variables are available in the predicate:</p>" +
        "<ul><li><code>#</code> – the current element</li>" +
        "<li><code>#acc</code> – the accumulator</li>" +
        "<li><code>#index</code> – the index of the current element</li></ul>" +
        "<div class='example'><div class='title'>Example</div><div class='code'>" +
        "<span class='highlighted'>reduce(1..9, #acc + #)</span></br>" +
        "<span class='highlighted'>reduce(1..9, #acc + #, 0)</span></div></div>",

      type: Kind.Func, generics: {T: [{ type: Kind.Any }], T2: [{ type: Kind.Any }], R: [{ type: Kind.Any }]}, args: [
        { name: "array", type: Kind.Slice, item: { type: Kind.Generic, generic: "T" } },
        {
          name: "predicate", type: Kind.Func,
          args: [{ name: "#index", type: Kind.Int }, { name: "#", type: Kind.Generic, generic: "T" }, { name: "#acc", type: Kind.Generic, generic: "T2" }],
          returns: [{ type: Kind.Generic, generic: "R" }]
        },
        { name: "initialValue", type: Kind.Generic, generic: "T2", required: false},
      ],
      returns: [{ type: Kind.Generic, generic: "R"  }]
    },
    sum: {
      name: "sum",
      description: "<p>Returns the sum of all numbers in the array.</p>" +
        "<div class='example'><div class='title'>Example</div><div class='code'><span class='highlighted'>sum([1, 2, 3]) == 6</span></div></div>" +
        "<p>If the optional <code>predicate</code> argument is given, it is a <code>predicate</code> that is " +
        "applied on each element of the array before summing.</p>" +
        "<div class='example'><div class='title'>Example</div><div class='code'><span class='highlighted'>sum(accounts, .Balance)</span></div></div>" +
        "<div class='example'><div class='title'>Equivalent to</div><div class='code'>" +
        "<span class='highlighted'>reduce(accounts, #acc + .Balance, 0)</span></br>" +
        "<span class='highlighted'>sum(map(accounts, .Balance))</span></div></div>",

      type: Kind.Func, generics: { T: [{ type: Kind.Any }], R: [{ type: ExprKind.Number }] },
      args: [
        { name: "array", type: Kind.Slice, item: { type: Kind.Generic, generic: "T" } },
        {
          name: "predicate", required: false,
          type: Kind.Func, args: [{ name: "#index", type: Kind.Int }, { name: "#", type: Kind.Generic, generic: "T" }],
          returns: [{ type: Kind.Generic, generic: "R" }],
        }
      ],
      returns: [{ type: ExprKind.Float }]
    },
    mean: {
      name: "mean",
      description: "<p>Returns the average of all numbers in the array.</p>" +
        "<div class='example'><div class='title'>Example</div><div class='code'>" +
        "<span class='highlighted'>mean([1, 2, 3]) == 2.0</span></div></div>",

      type: Kind.Func, args: [{name: "array", type: Kind.Slice, item: { type: ExprKind.Number }}], returns: [{ type: ExprKind.Float }]
    },
    median: {
      name: "median",
      description: "<p>Returns the median of all elements in the array.</p>" +
        "<div class='example'><div class='title'>Example</div><div class='code'>" +
        "<span class='highlighted'>median([1, 2, 3]) == 2.0</span></div></div>",

      type: Kind.Func, args: [{name: "array", type: Kind.Slice, item: { type: ExprKind.Number }}], returns: [{ type: ExprKind.Float }]
    },
    first: {
      name: "first",
      description: "<p>Returns the first element from an array. If the array is empty, returns <code>nil</code>.</p>" +
        "<div class='example'><div class='title'>Example</div><div class='code'><span class='highlighted'>first([1, 2, 3]) == 1</span></div></div>",

      type: Kind.Func, generics: {T: [{ type: Kind.Any }]},
      args: [{ name: "array", type: Kind.Slice, item: { type: Kind.Generic, generic: "T" }}],
      returns: [{ type: ExprKind.Optional, item: { type: Kind.Generic, generic: "T" }}]
    },
    last: {
      name: "last",
      description: "<p>Returns the last element from an array. If the array is empty, returns <code>nil</code>.</p>" +
        "<div class='example'><div class='title'>Example</div><div class='code'><span class='highlighted'>last([1, 2, 3]) == 3</span></div></div>",

      type: Kind.Func, generics: {T: [{ type: Kind.Any }]},
      args: [{ name: "array", type: Kind.Slice, item: { type: Kind.Generic, generic: "T" }}],
      returns: [{ type: ExprKind.Optional, item: { type: Kind.Generic, generic: "T" }}]
    },
    take: {
      name: "take",
      description: "<p>Returns the first <code>n</code> elements from an array. " +
        "If the array has fewer than <code>n</code> elements, returns the whole array.</p>" +
        "<div class='example'><div class='title'>Example</div><div class='code'><span class='highlighted'>take([1, 2, 3, 4], 2) == [1, 2]</span></div></div>",

      type: Kind.Func, generics: {T: [{ type: Kind.Any }]},
      args: [{ name: "array", type: Kind.Slice, item: { type: Kind.Generic, generic: "T" } }, { name: "n", type: Kind.Int }],
      returns: [{ type: Kind.Slice, item: { type: Kind.Generic, generic: "T" } }]
    },
    reverse: {
      name: "reverse",
      description: "<p>Returns new reversed copy of the array.</p>" +
        "<div class='example'><div class='title'>Example</div><div class='code'><span class='highlighted'>reverse([3, 1, 4]) == [4, 1, 3]</span></div></div>",

      type: Kind.Func, generics: {T: [{ type: Kind.Any }]},
      args: [{ name: "array", type: Kind.Slice, item: { type: Kind.Generic, generic: "T" }}],
      returns: [{ type: Kind.Slice, item: { type: Kind.Generic, generic: "T" }}]
    },
    sort: {
      name: "sort",
      description: "<p>Sorts an array in ascending order. " +
        "Optional <code>order</code> argument can be used to specify the order of sorting: <code>asc</code> or <code>desc</code>.</p>" +
        "<div class='example'><div class='title'>Example</div><div class='code'>" +
        "<span class='highlighted'>sort([3, 1, 4]) == [1, 3, 4]</span></br>" +
        "<span class='highlighted'>sort([3, 1, 4], \"desc\") == [4, 3, 1]</span></div></div>",

      type: Kind.Func, generics: {T: [{ type: Kind.Any }]}, args: [
        { name: "array", type: Kind.Slice, item: { type: Kind.Generic, generic: "T" } },
        { name: "order", required: false, type: Kind.String }
      ],
      returns: [{ type: Kind.Slice, item: { type: Kind.Generic, generic: "T" }}]
    },
    sortBy: {
      name: "sortBy",
      description: "<p>Sorts an array by the result of the" +
        "<a href='https://expr-lang.org/docs/language-definition#predicate' target='_blank'>predicate</a>.</p>" +
        "<p>Optional <code>order</code> argument can be used to specify the order of sorting: " +
        "<code>asc</code> or <code>desc</code>.</p>",

      type: Kind.Func, generics: {T: [{ type: Kind.Any }]}, args: [
        { name: "array", type: Kind.Slice, item: { type: Kind.Generic, generic: "T" } },
        { name: "predicate", type: Kind.Func, args: [{ name: "#", type: Kind.Generic, generic: "T" }], returns: [{ type: Kind.Any }]},
        { name: "order", required: false, type: Kind.String}
      ],
      returns: [{ type: Kind.Slice, item: { type: Kind.Generic, generic: "T" }}]
    },
    /* [Map Functions](https://expr-lang.org/docs/language-definition#map-functions) */
    keys: {
      name: "keys",
      description: "<p>Returns an array containing the keys of the map.</p>" +
        "<div class='example'><div class='title'>Example</div><div class='code'>" +
        "<span class='highlighted'>keys({\"name\": \"John\", \"age\": 30}) == [\"name\", \"age\"]</span></div></div>",

      type: Kind.Func, generics: {T: [{ type: Kind.Any }]},
      args: [{ name: "map", type: Kind.Map, key: { type: Kind.Generic, generic: "T" }, value: { type: Kind.Any} }],
      returns: [{ type: Kind.Slice, item: { type: Kind.Generic, generic: "T" }}]
    },
    values: {
      name: "values",
      description: "<p>Returns an array containing the values of the map.</p>" +
        "<div class='example'><div class='title'>Example</div><div class='code'>" +
        "<span class='highlighted'>values({\"name\": \"John\", \"age\": 30}) == [\"John\", 30]</span></div></div>",

      type: Kind.Func, generics: {T: [{ type: Kind.Any }]},
      args: [{ name: "map", type: Kind.Map, key: { type: Kind.Any}, value: { type: Kind.Generic, generic: "T" } }],
      returns: [{ type: Kind.Slice, item: { type: Kind.Generic, generic: "T" }}]
    },
    /* [Type Conversion Functions](https://expr-lang.org/docs/language-definition#type-conversion-functions) */
    type: {
      name: "type",
      description: "<p>Returns the type of the given value <code>v</code>.</p>" +
        "<p>Returns on of the following types:</p>" +
        "<ul><li><code>nil</code></li><li><code>bool</code></li><li><code>int</code></li>" +
        "<li><code>uint</code></li><li><code>float</code></li><li><code>string</code></li>" +
        "<li><code>array</code></li><li><code>map</code></li></ul>" +
        "<p>For named types and structs, the type name is returned.</p>" +
        "<div class='example'><div class='title'>Example</div><div class='code'>" +
        "<span class='highlighted'>type(42) == \"int\"</span><br />" +
        "<span class='highlighted'>type(\"hello\") == \"string\"</span><br />" +
        "<span class='highlighted'>type(now()) == \"time.Time\"</span></div></div>",

      type: Kind.Func, args: [{ name: "v", type: Kind.Any }], returns: [{ type: Kind.String }]
    },
    int: {
      name: "int",
      description: "<p>Returns the integer value of a number or a string.</p>" +
        "<div class='example'><div class='title'>Example</div><div class='code'><span class='highlighted'>int(\"123\") == 123</span></div></div>",

      type: Kind.Func, generics: { T: [{ type: ExprKind.Number }, { type: Kind.String }]},
      args: [{ name: "v",  type: Kind.Generic, generic: "T" }], returns: [{ type: Kind.Int }]
    },
    float: {
      name: "float",
      description: "<p>Returns the float value of a number or a string.</p>" +
        "<div class='example'><div class='title'>Example</div><div class='code'><span class='highlighted'>float(\"123.45\") == 123.45</span></div></div>",

      type: Kind.Func, generics: { T: [{ type: ExprKind.Number }, { type: Kind.String }]},
      args: [{ name: "v", type: Kind.Generic, generic: "T" }], returns: [{ type: ExprKind.Float }]
    },
    string: {
      name: "string",
      description: "<p>Converts the given value <code>v</code> into a string representation.</p>" +
        "<div class='example'><div class='title'>Example</div><div class='code'><span class='highlighted'>string(123) == \"123\"</span></div></div>",

      type: Kind.Func, args: [{ name: "v", type: Kind.Any }], returns: [{ type: Kind.String }]
    },
    toJSON: {
      name: "toJSON",
      description: "<p>Converts the given value <code>v</code> to its JSON string representation.</p>" +
        "<div class='example'><div class='title'>Example</div><div class='code'><span class='highlighted'>toJSON({\"name\": \"John\", \"age\": 30})</span></div></div>",

      type: Kind.Func, args: [{ name: "v", type: Kind.Any }], returns: [{ type: Kind.String }]
    },
    fromJSON: {
      name: "fromJSON",
      description: "<p>Parses the JSON string <code>v</code> and returns the corresponding value.</p>" +
        "<div class='example'><div class='title'>Example</div><div class='code'><span class='highlighted'>fromJSON('{\"name\": \"John\", \"age\": 30}')</span></div></div>",

      type: Kind.Func, args: [{ name: "v", type: Kind.String }], returns: [{ type: Kind.Any }]
    },
    toBase64: {
      name: "toBase64",
      description: "<p>Encodes the string <code>v</code> into Base64 format.</p>" +
        "<div class='example'><div class='title'>Example</div><div class='code'><span class='highlighted'>toBase64(\"Hello World\") == \"SGVsbG8gV29ybGQ=\"</span></div></div>",

      type: Kind.Func, args: [{ name: "v", type: Kind.String }], returns:[{ type: Kind.String }]
    },
    fromBase64: {
      name: "fromBase64",
      description: "<p>Decodes the Base64 string <code>v</code> back to its original form.</p>" +
        "<div class='example'><div class='title'>Example</div><div class='code'><span class='highlighted'>fromBase64(\"SGVsbG8gV29ybGQ=\") == \"Hello World\"</span></div></div>",

      type: Kind.Func, args: [{ name: "v", type: Kind.String }], returns: [{ type: Kind.String }]
    },
    toPairs: {
      name: "toPairs",
      description: "<p>Converts a map to an array of key-value pairs.</p>" +
        "<div class='example'><div class='title'>Example</div><div class='code'>" +
        "<span class='highlighted'>toPairs({\"name\": \"John\", \"age\": 30}) == [[\"name\", \"John\"], [\"age\", 30]]</span>" +
        "</div></p>",

      type: Kind.Func, args: [{ name: "map", type: Kind.Map, key: { type: Kind.Any }, value: { type: Kind.Any } }],
      returns: [{ type: Kind.Slice, item: { type: Kind.Slice, item: { type: Kind.Any } } }]
    },
    fromPairs: {
      name: "fromPairs",
      description: "<p>Converts an array of key-value pairs to a map.</p>" +
        "<div class='example'><div class='title'>Example</div><div class='code'>" +
        "<span class='highlighted'>fromPairs([[\"name\", \"John\"], [\"age\", 30]]) == {\"name\": \"John\", \"age\": 30}</span>" +
        "</div></p>",

      type: Kind.Func, args: [{ name: "array", type: Kind.Slice, item: { type: Kind.Any } }],
      returns: [{ type: Kind.Map, key: { type: Kind.Any }, value: { type: Kind.Any } }]
    },
    /* [Miscellaneous Functions](https://expr-lang.org/docs/language-definition#miscellaneous-functions) */
    len: {
      name: "len",
      description: "<p>Returns the length of an array, a map or a string.</p>" +
        "<div class='example'><div class='title'>Example</div><div class='code'><span class='highlighted'>len([1, 2, 3]) == 3</span></div></div>",

      type: Kind.Func, generics: {T: [
          { type: Kind.String },
          { type: Kind.Slice, item: { type: Kind.Any } },
          { type: Kind.Map, key: { type: Kind.Any }, value: { type: Kind.Any } },
        ]
      },
      args: [{ name: "v", type: Kind.Generic, generic: "T" }], returns: [{ type: Kind.Int }]
    },
    get: {
      name: "get",
      description: "<p>Retrieves the element at the specified index from an array or map <code>v</code>. " +
        "If the index is out of range, returns <code>nil</code>. Or the key does not exist, returns <code>nil</code>.</p>" +
        "<div class='example'><div class='title'>Example</div><div class='code'>" +
        "<span class='highlighted'>get([1, 2, 3], 1) == 2</span></br>" +
        "<span class='highlighted'>get({\"name\": \"John\", \"age\": 30}, \"name\") == \"John\"</span></div></div>",

      type: Kind.Func, generics: {
        I: [{ type: Kind.Any }],
        V: [
          { type: Kind.String },
          { type: Kind.Slice, item: { type: Kind.Generic, generic: "I" } },
          { type: Kind.Map, key: { type: Kind.Any }, value: { type: Kind.Generic, generic: "I" } },
        ],
        T: [{ type: Kind.Int }, { type: Kind.String }],
      },
      args: [{ name: "v", type: Kind.Generic, generic: "V" }, { name: "index", type: Kind.Generic, generic: "T"}],
      returns: [{ type: ExprKind.Optional, item: { type: Kind.Generic, generic: "I" } }]
    },
    /* [Bitwise Functions](https://expr-lang.org/docs/language-definition#bitwise-functions) */
    bitand: {
      name: "bitand",
      description: "<p>Returns the values resulting from the bitwise AND operation.</p>" +
        "<div class='example'><div class='title'>Example</div><div class='code'>" +
        "<span class='highlighted'>bitand(0b1010, 0b1100) == 0b1000</span></div></div>",

      type: Kind.Func, args: [{ name: "a", type: Kind.Int }, { name: "b", type: Kind.Int }], returns: [{ type: Kind.Int }]
    },
    bitor: {
      name: "bitor",
      description: "<p>Returns the values resulting from the bitwise OR operation.</p>" +
        "<div class='example'><div class='title'>Example</div><div class='code'>" +
        "<span class='highlighted'>bitor(0b1010, 0b1100) == 0b1110</span></div></div>",

      type: Kind.Func, args: [{ name: "a", type: Kind.Int }, { name: "b", type: Kind.Int }], returns: [{ type: Kind.Int }]
    },
    bitxor: {
      name: "bitxor",
      description: "<p>Returns the values resulting from the bitwise XOR operation.</p>" +
        "<div class='example'><div class='title'>Example</div><div class='code'>" +
        "<span class='highlighted'>bitxor(0b1010, 0b1100) == 0b110</span></div></div>",

      type: Kind.Func, args: [{ name: "a", type: Kind.Int }, { name: "b", type: Kind.Int }], returns: [{ type: Kind.Int }]
    },
    bitnand: {
      name: "bitnand",
      description: "<p>Returns the values resulting from the bitwise AND NOT operation.</p>" +
        "<div class='example'><div class='title'>Example</div><div class='code'>" +
        "<span class='highlighted'>bitnand(0b1010, 0b1100) == 0b10</span></div></div>",

      type: Kind.Func, args: [{ name: "a", type: Kind.Int }, { name: "b", type: Kind.Int }], returns: [{ type: Kind.Int }]
    },
    bitnot: {
      name: "bitnot",
      description: "<p>Returns the values resulting from the bitwise NOT operation.</p>" +
        "<div class='example'><div class='title'>Example</div><div class='code'>" +
        "<span class='highlighted'>bitnot(0b1010) == -0b1011</span></div></div>",

      type: Kind.Func, args: [{ name: "a", type: Kind.Int }, { name: "b", type: Kind.Int }], returns: [{ type: Kind.Int }]
    },
    bitshl: {
      name: "bitshl",
      description: "<p>Returns the values resulting from the Left Shift operation.</p>" +
        "<div class='example'><div class='title'>Example</div><div class='code'>" +
        "<span class='highlighted'>bitshl(0b101101, 2) == 0b10110100</span></div></div>",

      type: Kind.Func, args: [{ name: "a", type: Kind.Int }, { name: "b", type: Kind.Int }], returns: [{ type: Kind.Int }]
    },
    bitshr: {
      name: "bitshr",
      description: "<p>Returns the values resulting from the Right Shift operation.</p>" +
        "<div class='example'><div class='title'>Example</div><div class='code'>" +
        "<span class='highlighted'>bitshr(0b101101, 2) == 0b1011</span></div></div>",

      type: Kind.Func, args: [{ name: "a", type: Kind.Int }, { name: "b", type: Kind.Int }], returns: [{ type: Kind.Int }]
    },
    bitushr: {
      name: "bitushr",
      description: "<p>Returns the values resulting from the unsigned Right Shift operation.</p>" +
        "<div class='example'><div class='title'>Example</div><div class='code'>" +
        "<span class='highlighted'>bitushr(-0b101, 2) == 4611686018427387902</span></div></div>",

      type: Kind.Func, args: [{ name: "a", type: Kind.Int }, { name: "b", type: Kind.Int }], returns: [{ type: Kind.Int }]
    }
  },
  types: {
    "time.Time": {
      package: "time", name: "Time",
      description: "A Time represents an instant in time with nanosecond precision.\n\n" +
        "Programs using times should typically store and pass them as values, not pointers. That is, time variables and struct fields should be of type time.Time, not *time.Time.\n\n" +
        "A Time value can be used by multiple goroutines simultaneously except that the methods GobDecode, UnmarshalBinary, UnmarshalJSON and UnmarshalText are not concurrency-safe.\n\n" +
        "Time instants can be compared using the Before, After, and Equal methods. The Sub method subtracts two instants, producing a Duration. The Add method adds a Time and a Duration, producing a Time.\n\n" +
        "The zero value of type Time is January 1, year 1, 00:00:00.000000000 UTC. As this time is unlikely to come up in practice, the IsZero method gives a simple way of detecting a time that has not been initialized explicitly.\n\n" +
        "Each time has an associated Location. The methods Local, UTC, and In return a Time with a specific Location. Changing the Location of a Time value with these methods does not change the actual instant it represents, only the time zone in which to interpret it.\n\n" +
        "Representations of a Time value saved by the GobEncode, MarshalBinary, MarshalJSON, and MarshalText methods store the Time.Location's offset, but not the location name. They therefore lose information about Daylight Saving Time.\n\n" +
        "In addition to the required “wall clock” reading, a Time may contain an optional reading of the current process's monotonic clock, to provide additional precision for comparison or subtraction. See the “Monotonic Clocks” section in the package documentation for details.\n\n" +
        "Note that the Go == operator compares not just the time instant but also the Location and the monotonic clock reading. Therefore, Time values should not be used as map or database keys without first guaranteeing that the identical Location has been set for all values, which can be achieved through use of the UTC or Local method, and that the monotonic clock reading has been stripped by setting t = t.Round(0). In general, prefer t.Equal(u) to t == u, since t.Equal uses the most accurate comparison available and correctly handles the case when only one of its arguments has a monotonic clock reading.",
      type: Kind.Struct, fields: {}, methods: {
        Add: {
          name: "Add", description: "Add returns the time t+d.",
          receiver: { type: Kind.Defined, typeName: "time.Time" },
          type: Kind.Func, args: [{ name: "d", type: Kind.Defined, typeName: "time.Duration" }],
          returns: [{ type: Kind.Defined, typeName: "time.Time" }]
        },
        AddDate: {
          name: "AddDate", description: "AddDate returns the time corresponding to adding the given number of years, months, and days to t.",
          receiver: { type: Kind.Defined, typeName: "time.Time" },
          type: Kind.Func, args: [
            { name: "years", type: Kind.Int }, { name: "months", type: Kind.Int }, { name: "days", type: Kind.Int }
          ],
          returns: [{ type: Kind.Defined, typeName: "time.Time" }]
        },
        After: {
          name: "After", description: "After reports whether the time instant t is after u.",
          receiver: { type: Kind.Defined, typeName: "time.Time" },
          type: Kind.Func, args: [{ name: "u", type: Kind.Defined, typeName: "time.Time" }], returns: [{ type: Kind.Bool }]
        },
        AppendFormat: {
          name: "AppendFormat", description: "AppendFormat is like Format but appends the textual representation to b and returns the extended buffer.",
          receiver: { type: Kind.Defined, typeName: "time.Time" },
          type: Kind.Func, args: [{ name: "b", type: Kind.String }, { name: "layout", type: Kind.String }], returns: [{ type: Kind.String }]
        },
        Before: {
          name: "Before", description: "Before reports whether the time instant t is before u.",
          receiver: { type: Kind.Defined, typeName: "time.Time" },
          type: Kind.Func, args: [{ name: "u", type: Kind.Defined, typeName: "time.Time" }], returns: [{ type: Kind.Bool }]
        },
        Clock: {
          name: "Clock", description: "Clock returns the hour, minute, and second within the day specified by t.",
          receiver: { type: Kind.Defined, typeName: "time.Time" },
          type: Kind.Func, args: [], returns: [{ type: Kind.Int }, { type: Kind.Int }, { type: Kind.Int }]
        },
        Compare: {
          name: "Compare", description: "Compare compares the time instant t with u. If t is before u, it returns -1; if t is after u, it returns +1; if they're the same, it returns 0.",
          receiver: { type: Kind.Defined, typeName: "time.Time" },
          type: Kind.Func, args: [{ name: "u", type: Kind.Defined, typeName: "time.Time" }], returns: [{ type: Kind.Int }]
        },
        Date: {
          name: "Date", description: "Date returns the year, month, and day in which t occurs.",
          receiver: { type: Kind.Defined, typeName: "time.Time" },
          type: Kind.Func, args: [], returns: [{ type: Kind.Int }, { type: Kind.Int }, { type: Kind.Int }]
        },
        Day: {
          name: "Day", description: "Day returns the day of the month specified by t.",
          receiver: { type: Kind.Defined, typeName: "time.Time" },
          type: Kind.Func, args: [], returns: [{ type: Kind.Int }]
        },
        Equal: {
          name: "Equal", description: "Equal reports whether t and u represent the same time instant.",
          receiver: { type: Kind.Defined, typeName: "time.Time" },
          type: Kind.Func, args: [{ name: "u", type: Kind.Defined, typeName: "time.Time" }], returns: [{ type: Kind.Bool }]
        },
        Format: {
          name: "Format", description: "Format returns a textual representation of the time value formatted according to the layout defined by the argument.",
          receiver: { type: Kind.Defined, typeName: "time.Time" },
          type: Kind.Func, args: [{ name: "layout", type: Kind.String }], returns: [{ type: Kind.String }]
        },
        GoString: {
          name: "GoString", description: "GoString implements fmt.GoStringer and formats t to be printed in Go source code.",
          receiver: { type: Kind.Defined, typeName: "time.Time" },
          type: Kind.Func, args: [], returns: [{ type: Kind.String }]
        },
        GobDecode: {
          name: "GobDecode", description: "GobDecode implements the gob.GobDecoder interface.",
          receiver: { type: Kind.Defined, typeName: "time.Time" },
          type: Kind.Func, args: [{ name: "b", type: Kind.Slice, item: {type: Kind.Byte} }], returns: [{ type: Kind.Error }]
        },
        GobEncode: {
          name: "GobEncode", description: "GobEncode implements the gob.GobEncoder interface.",
          receiver: { type: Kind.Defined, typeName: "time.Time" },
          type: Kind.Func, args: [], returns: [{ type: Kind.Slice, item: {type: Kind.Byte} },  { type: Kind.Error }]
        },
        Hour: {
          name: "Hour", description: "Hour returns the hour within the day specified by t, in the range [0, 23].",
          receiver: { type: Kind.Defined, typeName: "time.Time" },
          type: Kind.Func, args: [], returns: [{ type: Kind.Int }]
        },
        ISOWeek: {
          name: "ISOWeek", description: "ISOWeek returns the ISO 8601 year and week number in which t occurs.",
          receiver: { type: Kind.Defined, typeName: "time.Time" },
          type: Kind.Func, args: [], returns: [{ type: Kind.Int }, { type: Kind.Int }]
        },
        In: {
          name: "In", description: "In returns a copy of t representing the same time instant, but with the copy's location " +
            "information set to loc for display purposes.",
          receiver: { type: Kind.Defined, typeName: "time.Time" },
          type: Kind.Func, args: [{ name: "loc", type: Kind.Defined, typeName: "time.Location" }], returns: [{ type: Kind.Defined, typeName: "time.Time" }]
        },
        IsDST: {
          name: "IsDST", description: "IsDST reports whether the time in the configured location is in Daylight Savings Time.",
          receiver: { type: Kind.Defined, typeName: "time.Time" },
          type: Kind.Func, args: [], returns: [{ type: Kind.Bool }]
        },
        IsZero: {
          name: "IsZero", description: "IsZero reports whether t represents the zero time instant, January 1, year 1, 00:00:00 UTC.",
          receiver: { type: Kind.Defined, typeName: "time.Time" },
          type: Kind.Func, args: [], returns: [{ type: Kind.Bool }]
        },
        Local: {
          name: "IsZero", description: "Local returns t with the location set to local time.",
          receiver: { type: Kind.Defined, typeName: "time.Time" },
          type: Kind.Func, args: [], returns: [{ type: Kind.Defined, typeName: "time.Time" }]
        },
        Location: {
          name: "Location", description: "Location returns the time zone information associated with t",
          receiver: { type: Kind.Defined, typeName: "time.Time" },
          type: Kind.Func, args: [], returns: [{ type: Kind.Defined, typeName: "time.Location" }]
        },
        MarshalBinary: {
          name: "MarshalBinary", description: "MarshalBinary implements the encoding.BinaryMarshaler interface.",
          receiver: { type: Kind.Defined, typeName: "time.Time" },
          type: Kind.Func, args: [], returns: [{type: Kind.Slice, item: {type: Kind.Byte}}, { type: Kind.Error }]
        },
        MarshalJSON: {
          name: "MarshalJSON", description: "MarshalJSON implements the json.Marshaler interface.",
          receiver: { type: Kind.Defined, typeName: "time.Time" },
          type: Kind.Func, args: [], returns: [{ type: Kind.Slice, item: {type: Kind.Byte}}, { type: Kind.Error }]
        },
        MarshalText: {
          name: "MarshalText", description: "MarshalText implements the encoding.TextMarshaler interface.",
          receiver: { type: Kind.Defined, typeName: "time.Time" },
          type: Kind.Func, args: [], returns: [{ type: Kind.Slice, item: {type: Kind.Byte}}, { type: Kind.Error }]
        },
        Minute: {
          name: "Minute", description: "Minute returns the minute offset within the hour specified by t, in the range [0, 59].",
          receiver: { type: Kind.Defined, typeName: "time.Time" },
          type: Kind.Func, args: [], returns: [{ type: Kind.Int }]
        },
        Month: {
          name: "Month", description: "Month returns the month of the year specified by t.",
          receiver: { type: Kind.Defined, typeName: "time.Time" },
          type: Kind.Func, args: [], returns: [{ type: Kind.Defined, typeName: "time.Month" }]
        },
        Nanosecond: {
          name: "Nanosecond", description: "Nanosecond returns the nanosecond offset within the second specified by t, in the range [0, 999999999].",
          receiver: { type: Kind.Defined, typeName: "time.Time" },
          type: Kind.Func, args: [], returns: [{ type: Kind.Int }]
        },
        Round: {
          name: "Round", description: "Round returns the result of rounding t to the nearest multiple of d (since the zero time).",
          receiver: { type: Kind.Defined, typeName: "time.Time" },
          type: Kind.Func, args: [{ name: "d", type: Kind.Defined, typeName: "time.Duration" }], returns: [{ type: Kind.Defined, typeName: "time.Time" }]
        },
        Second: {
          name: "Second", description: "Second returns the second offset within the minute specified by t, in the range [0, 59].",
          receiver: { type: Kind.Defined, typeName: "time.Time" },
          type: Kind.Func, args: [], returns: [{ type: Kind.Int }]
        },
        String: {
          name: "String", description: "String returns the time formatted using the format string `2006-01-02 15:04:05.999999999 -0700 MST`.",
          receiver: { type: Kind.Defined, typeName: "time.Time" },
          type: Kind.Func, args: [], returns: [{ type: Kind.String }]
        },
        Sub: {
          name: "Sub", description: "Sub returns the duration t-u.",
          receiver: { type: Kind.Defined, typeName: "time.Time" },
          type: Kind.Func,  args: [{ name: "u", type: Kind.Defined, typeName: "time.Time" }], returns: [{ type: Kind.Defined, typeName: "time.Duration" }]
        },
        Truncate: {
          name: "Truncate", description: "Truncate returns the result of rounding t down to a multiple of d (since the zero time).",
          receiver: { type: Kind.Defined, typeName: "time.Time" },
          type: Kind.Func, args: [{ name: "d", type: Kind.Defined, typeName: "time.Duration" }], returns: [{ type: Kind.Defined, typeName: "time.Time" }]
        },
        UTC: {
          name: "UTC", description: "UTC returns t with the location set to UTC.",
          receiver: { type: Kind.Defined, typeName: "time.Time" },
          type: Kind.Func, args: [], returns: [{ type: Kind.Defined, typeName: "time.Time" }]
        },
        Unix: {
          name: "Unix", description: "Unix returns t as a Unix time, the number of seconds elapsed since January 1, 1970 UTC",
          receiver: { type: Kind.Defined, typeName: "time.Time" },
          type: Kind.Func, args: [], returns: [{ type: Kind.Int64 }]
        },
        UnixMicro: {
          name: "UnixMicro", description: "UnixMicro returns t as a Unix time, the number of microseconds elapsed since January 1, 1970 UTC.",
          receiver: { type: Kind.Defined, typeName: "time.Time" },
          type: Kind.Func, args: [], returns: [{ type: Kind.Int64 }]
        },
        UnixMilli: {
          name: "UnixMilli", description: "UnixMilli returns t as a Unix time, the number of milliseconds elapsed since January 1, 1970 UTC.",
          receiver: { type: Kind.Defined, typeName: "time.Time" },
          type: Kind.Func, args: [], returns: [{ type: Kind.Int64 }]
        },
        UnixNano: {
          name: "UnixNano", description: "UnixNano returns t as a Unix time, the number of nanoseconds elapsed since January 1, 1970 UTC.",
          receiver: { type: Kind.Defined, typeName: "time.Time" },
          type: Kind.Func, args: [], returns: [{ type: Kind.Int64 }]
        },
        UnmarshalBinary: {
          name: "UnmarshalBinary", description: "UnmarshalBinary implements the encoding.BinaryUnmarshaler interface.",
          receiver: { type: Kind.Defined, typeName: "time.Time" },
          type: Kind.Func, args: [{ name: "data", type: Kind.Slice, item: { type: Kind.Byte } }], returns: [{ type: Kind.Error }]
        },
        UnmarshalJSON: {
          name: "UnmarshalJSON", description: "UnmarshalJSON implements the json.Unmarshaler interface.",
          receiver: { type: Kind.Defined, typeName: "time.Time" },
          type: Kind.Func, args: [{ name: "data", type: Kind.Slice, item: { type: Kind.Byte } }], returns: [{ type: Kind.Error }]
        },
        UnmarshalText: {
          name: "UnmarshalText", description: "UnmarshalText implements the encoding.TextUnmarshaler interface.",
          receiver: { type: Kind.Defined, typeName: "time.Time" },
          type: Kind.Func, args: [{ name: "data", type: Kind.Slice, item: { type: Kind.Byte } }], returns: [{ type: Kind.Error }]
        },
        Weekday: {
          name: "Weekday", description: "Weekday returns the day of the week specified by t.",
          receiver: { type: Kind.Defined, typeName: "time.Time" },
          type: Kind.Func, args: [], returns: [{ type: Kind.Defined, typeName: "time.Weekday" }]
        },
        Year: {
          name: "Year", description: "Year returns the year in which t occurs.",
          receiver: { type: Kind.Defined, typeName: "time.Time" },
          type: Kind.Func, args: [], returns: [{ type: Kind.Int }]
        },
        YearDay: {
          name: "YearDay", description: "YearDay returns the day of the year specified by t, in the range [1,365] " +
            "for non-leap years, and [1,366] in leap years.",
          receiver: { type: Kind.Defined, typeName: "time.Time" },
          type: Kind.Func, args: [], returns: [{ type: Kind.Int }]
        },
        Zone: {
          name: "Zone", description: "Zone computes the time zone in effect at time t, returning the abbreviated name " +
            "of the zone (such as \"CET\") and its offset in seconds east of UTC.",
          receiver: { type: Kind.Defined, typeName: "time.Time" },
          type: Kind.Func, args: [], returns: [{ type: Kind.String }, { type: Kind.Int }]
        },
        ZoneBounds: {
          name: "ZoneBounds", description: "ZoneBounds returns the bounds of the time zone in effect at time t. The zone begins at start and the next zone begins at end.",
          receiver: { type: Kind.Defined, typeName: "time.Time" },
          type: Kind.Func, args: [], returns: [{ type: Kind.Defined, typeName: "time.Time" }, { type: Kind.Defined, typeName: "time.Time" }]
        }
      },
    },
    "time.Duration": {
      package: "time", name: "Duration", type: Kind.Int64, methods: {
        Abs: {
          name: "Abs", description: "Abs returns the absolute value of d.",
          receiver: { type: Kind.Defined, typeName: "time.Duration" },
          type: Kind.Func, args: [], returns: [{ type: Kind.Defined, typeName: "time.Duration" }]
        },
        Hours: {
          name: "Hours", description: "Hours returns the duration as a floating point number of hours.",
          receiver: { type: Kind.Defined, typeName: "time.Duration" },
          type: Kind.Func, args: [], returns: [{ type: Kind.Float64 }]
        },
        Microseconds: {
          name: "Microseconds", description: "Microseconds returns the duration as an integer microsecond count.",
          receiver: { type: Kind.Defined, typeName: "time.Duration" },
          type: Kind.Func, args: [], returns: [{ type: Kind.Int64 }]
        },
        Milliseconds: {
          name: "Milliseconds", description: "Milliseconds returns the duration as an integer millisecond count.",
          receiver: { type: Kind.Defined, typeName: "time.Duration" },
          type: Kind.Func, args: [], returns: [{ type: Kind.Int64 }]
        },
        Minutes: {
          name: "Minutes", description: "Minutes returns the duration as a floating point number of minutes.",
          receiver: { type: Kind.Defined, typeName: "time.Duration" },
          type: Kind.Func, args: [], returns: [{ type: Kind.Float64 }]
        },
        Nanoseconds: {
          name: "Nanoseconds", description: "Nanoseconds returns the duration as an integer nanosecond count.",
          receiver: { type: Kind.Defined, typeName: "time.Duration" },
          type: Kind.Func, args: [], returns: [{ type: Kind.Int64 }]
        },
        Round: {
          name: "Round", description: "Round returns the result of rounding d to the nearest multiple of m.",
          receiver: { type: Kind.Defined, typeName: "time.Duration" },
          type: Kind.Func, args: [{ name: "m", type: Kind.Defined, typeName: "time.Duration" }], returns: [{ type: Kind.Defined, typeName: "time.Duration" }]
        },
        Seconds: {
          name: "Seconds", description: "Seconds returns the duration as a floating point number of seconds.",
          receiver: { type: Kind.Defined, typeName: "time.Duration" },
          type: Kind.Func, args: [], returns: [{ type: ExprKind.Float }]
        },
        String: {
          name: "String", description: `String returns a string representing the duration in the form "72h3m0.5s". `,
          receiver: { type: Kind.Defined, typeName: "time.Duration" },
          type: Kind.Func, args: [], returns: [{ type: Kind.String }]
        },
        Truncate: {
          name: "Truncate", description: "Truncate returns the result of rounding d toward zero to a multiple of m. If m <= 0, Truncate returns d unchanged.",
          receiver: { type: Kind.Defined, typeName: "time.Duration" },
          type: Kind.Func, args: [{ name: "m", type: Kind.Defined, typeName: "time.Duration" }], returns: [{ type: Kind.Defined, typeName: "time.Duration" }]
        }
      }
    },
    "time.Location": {
      package: "time", name: "Location", type: Kind.Struct, fields: {},
      description: " A Location maps time instants to the zone in use at that time." +
        " Typically, the Location represents the collection of time offsets " +
        " in use in a geographical area. For many Locations the time offset varies" +
        " depending on whether daylight savings time is in use at the time instant." +
        " \n\n" +
        " Location is used to provide a time zone in a printed Time value and for" +
        " calculations involving intervals that may cross daylight savings time boundaries.",
      methods: {
        String: {
          name: "String",  description: "String returns a descriptive name for the time zone information, " +
            "corresponding to the name argument to LoadLocation or FixedZone.",
          receiver: { type: Kind.Pointer, to: { type: Kind.Defined, typeName: "time.Location" } },
          type: Kind.Func, args: [], returns: [{type: Kind.String}]
        }
      }
    },
    "time.Month": {
      package: "time", name: "Month", type: Kind.Int,
      description: "A Month specifies a month of the year (January = 1, ...).",
      methods: {
        String: {
          name: "String", description: `String returns the English name of the month ("January", "February", ...).`,
          receiver: { type: Kind.Defined, typeName: "time.Month" },
          type: Kind.Func, args: [], returns: [{ type: Kind.String }]
        }
      }
    },
    "time.Weekday": {
      package: "time", name: "Weekday", type: Kind.Int,
      description: "A Weekday specifies a day of the week (Sunday = 0, ...).",
      methods: {
        String: {
          name: "String", description: 'String returns the English name of the day ("Sunday", "Monday", ...).',
          receiver: { type: Kind.Defined, typeName: "time.Weekday" },
          type: Kind.Func, args: [], returns: [{ type: Kind.String }]
        }
      }
    }
  },
}