const browserGlobals = {
  Blob: "readonly",
  DOMException: "readonly",
  Event: "readonly",
  FileReader: "readonly",
  HTMLElement: "readonly",
  KeyboardEvent: "readonly",
  TextEncoder: "readonly",
  URL: "readonly",
  crypto: "readonly",
  document: "readonly",
  localStorage: "readonly",
  window: "readonly"
};

const nodeGlobals = {
  Buffer: "readonly",
  console: "readonly",
  process: "readonly"
};

const rules = {
  "constructor-super": "error",
  eqeqeq: ["error", "always"],
  "no-const-assign": "error",
  "no-dupe-args": "error",
  "no-dupe-class-members": "error",
  "no-dupe-keys": "error",
  "no-func-assign": "error",
  "no-import-assign": "error",
  "no-redeclare": "error",
  "no-unreachable": "error",
  "no-unsafe-finally": "error",
  "no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
  "no-undef": "error",
  "no-unexpected-multiline": "error",
  "use-isnan": "error",
  "valid-typeof": "error"
};

export default [
  {
    ignores: [
      "node_modules/**",
      "output/**",
      "playwright-report/**",
      "test-results/**"
    ]
  },
  {
    files: ["js/**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: browserGlobals
    },
    rules
  },
  {
    files: ["tests/**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: { ...browserGlobals, ...nodeGlobals }
    },
    rules
  },
  {
    files: ["*.config.js", "scripts/**/*.mjs"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: nodeGlobals
    },
    rules
  }
];
