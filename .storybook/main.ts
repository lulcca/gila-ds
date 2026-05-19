import type { StorybookConfig } from '@storybook/vue3-vite';
import vue from '@vitejs/plugin-vue';

const config: StorybookConfig = {
  addons: ['@storybook/addon-a11y', '@storybook/addon-docs'],
  core: {
    disableTelemetry: true,
    disableWhatsNewNotifications: true,
  },
  features: {
    sidebarOnboardingChecklist: false,
  },
  framework: '@storybook/vue3-vite',
  stories: ['../src/components/**/*.stories.ts'],
  viteFinal: async (config) => {
    if (process.env.STORYBOOK_BASE_PATH) config.base = process.env.STORYBOOK_BASE_PATH;

    config.plugins = [...(config.plugins ?? []), vue()];

    return config;
  },
};

export default config;
