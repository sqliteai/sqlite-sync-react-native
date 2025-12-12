import { fixupConfigRules } from '@eslint/compat';
import { FlatCompat } from '@eslint/eslintrc';
import js from '@eslint/js';
import prettier from 'eslint-plugin-prettier';
import { defineConfig } from 'eslint/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all,
});

export default defineConfig([
  {
    extends: fixupConfigRules(compat.extends('@react-native', 'prettier')),
    plugins: { prettier },
    rules: {
      'react/react-in-jsx-scope': 'off',
      'prettier/prettier': 'error',

      // ===================================================================
      // React Hooks Rules - Configured for Production Library Code
      // ===================================================================

      // CRITICAL RULES
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/set-state-in-render': 'error',
      'react-hooks/purity': 'error',

      // IMPORTANT RULES
      'react-hooks/static-components': 'warn',
      'react-hooks/immutability': 'warn',
      'react-hooks/refs': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/error-boundaries': 'warn',
      'react-hooks/use-memo': 'warn',
      'react-hooks/preserve-manual-memoization': 'warn',
      'react-hooks/exhaustive-deps': 'warn',
      'react-hooks/unsupported-syntax': 'warn',
      'react-hooks/incompatible-library': 'warn',
      'react-hooks/component-hook-factories': 'warn',
      'react-hooks/globals': 'warn',
      'react-hooks/config': 'warn',
      'react-hooks/gating': 'warn',
    },
  },
  {
    ignores: ['node_modules/', 'lib/', 'eslint.config.mjs'],
  },
]);
