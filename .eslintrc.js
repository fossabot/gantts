module.exports = {
  "parser": "@typescript-eslint/parser",
  parserOptions: {
      ecmaVersion: 6,
      sourceType: "module",
      ecmaFeatures: {
          modules: true
      }
  },
  "plugins": [
      "@typescript-eslint",
      "react",
  ],
  "rules": {
      "@typescript-eslint/member-delimiter-style": [
          "error",
          {
              "multiline": {
                  "delimiter": "semi",
                  "requireLast": true
              },
              "singleline": {
                  "delimiter": "semi",
                  "requireLast": false
              }
          }
      ],
      "@typescript-eslint/quotes": [
          "error",
          "single"
      ],
      "@typescript-eslint/semi": [
          "error",
          "always"
      ],
      "jsx-quotes": [
          "error",
          "prefer-double"
      ],
      "react/jsx-curly-spacing": [2, {"when": "always", "allowMultiline": true, "attributes": false}],
      "object-curly-spacing": ["warn", "always"],
      "template-curly-spacing": "warn",
      "no-duplicate-imports": "error",
      "no-multiple-empty-lines": "error",
      "comma-dangle": ["error", "always-multiline"],
      "curly": "error",
  }
};
