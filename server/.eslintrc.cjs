module.exports = {
  root: true,
  env: { node: true, es2022: true },
  extends: [
    "eslint:recommended",
    "plugin:import/recommended",
    "prettier",
  ],
  parserOptions: { ecmaVersion: "latest" },
  rules: {
    "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
    "import/no-unresolved": "off",
  },
  ignorePatterns: ["node_modules/", "dist/"],
};
