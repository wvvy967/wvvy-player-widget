/** @type {import('prettier').Config} */
export default {
  singleQuote: true,
  semi: true,
  tabWidth: 2,
  bracketSameLine: false,
  useTabs: false,
  arrowParens: 'always',
  endOfLine: 'lf',
  trailingComma: 'none',
  printWidth: 200,
  plugins: ['prettier-plugin-svelte', 'prettier-plugin-tailwindcss'],
  overrides: [
    {
      files: '*.svelte',
      options: { parser: 'svelte' }
    }
  ]
};
