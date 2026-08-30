import type { Preview } from '@storybook/react-vite';

const preview: Preview = {
  parameters: {
    layout: 'fullscreen',
    a11y: { test: 'todo' },
    backgrounds: { disable: true },
  },
};

export default preview;
