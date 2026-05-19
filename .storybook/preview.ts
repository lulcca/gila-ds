import '../src/styles/tokens.css';
import type { Preview } from '@storybook/vue3-vite';

const preview: Preview = {
  parameters: {
    a11y: {
      test: 'error',
    },
    docs: {
      story: {
        height: '520px',
      },
    },
    layout: 'centered',
  },
};

export default preview;
