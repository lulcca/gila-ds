import { defineConfigWithVueTs, vueTsConfigs } from '@vue/eslint-config-typescript';
import { globalIgnores } from 'eslint/config';
import pluginStorybook from 'eslint-plugin-storybook';
import pluginVue from 'eslint-plugin-vue';

export default defineConfigWithVueTs(
  globalIgnores(['**/storybook-static/**']),

  ...pluginVue.configs['flat/essential'],
  vueTsConfigs.recommended,

  ...pluginStorybook.configs['flat/recommended'],

  {
    rules: {
      'comma-dangle': ['warn', 'always-multiline'],
      'eol-last': 'error',
      'no-multi-spaces': ['error', { exceptions: { Property: false } }],
      'no-trailing-spaces': 'error',
      quotes: ['warn', 'single'],
      semi: ['error', 'always'],
      'sort-imports': 'error',
      'sort-keys': 'error',
      'sort-vars': 'error',
    },
  },
);
