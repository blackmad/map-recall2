import type { StorybookConfig } from '@storybook/react-vite';

const config: StorybookConfig = {
  stories: ['../stories/**/*.stories.@(ts|tsx)'],
  addons: ['@storybook/addon-a11y'],
  framework: { name: '@storybook/react-vite', options: {} },
  staticDirs: ['../public'],
  // Storybook copies staticDirs itself. Disable Vite's default `public/` copy
  // or both writers race to create large extract directories in the build.
  viteFinal: async viteConfig => ({ ...viteConfig, publicDir: false }),
};

export default config;
