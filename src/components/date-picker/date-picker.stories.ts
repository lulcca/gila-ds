import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { DatePicker } from '.';
import type { ICalendarDate } from '.';
import { ref } from 'vue';

const meta: Meta<typeof DatePicker> = {
  argTypes: {
    locale: {
      control: 'select',
      description: 'BCP 47 locale tag passed straight to `Intl.DateTimeFormat`.',
      options: ['en-US', 'pt-BR', 'fr-FR', 'de-DE', 'ja-JP'],
    },
  },
  component: DatePicker,
  parameters: {
    docs: {
      description: {
        component: `
A headless calendar engine (vanilla TypeScript) wrapped by a Vue 3 component.

**Highlights**
- BEM-styled, themable via \`--ds-*\` and \`--date-picker-*\` CSS variables.
- Full keyboard support: arrow keys, \`Home\`/\`End\`, \`PageUp\`/\`PageDown\`
  (year jump with \`Shift\`), \`Enter\`/\`Space\` to select, \`Esc\` to close.
- WAI-ARIA combobox + grid pattern with roving \`tabindex\` and verbose
  per-cell \`aria-label\`.
- Locale-aware month and weekday names via \`Intl.DateTimeFormat\`.
`,
      },
    },
    // Every story renders edge-to-edge so the themed wrapper looks like a
    // real app shell — same dimensions across stories, in both views.
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
  title: 'Components/DatePicker',
};

export default meta;

type Story = StoryObj<typeof DatePicker>;

/**
 * Every story renders the exact same DOM structure: an outer wrapper that
 * paints `--ds-color-bg` and cascades theme tokens, with a fixed-size shell
 * inside. Stories with no theme cascade default tokens (white bg) and look
 * visually identical to the docs card; themed stories paint themselves with
 * whatever `--ds-color-bg` their theme provides.
 *
 * This guarantees that *every* story has the same height and width — the
 * theme is the only thing that changes.
 */
type ShellOptions = {
  themeVars?: string;
};

const Shell = (args: Record<string, unknown>, options: ShellOptions = {}) => ({
  components: { DatePicker },
  setup() {
    const { modelValue: initial, ...rest } = args as Record<string, unknown> & {
      modelValue?: ICalendarDate | null;
    };
    const date = ref<ICalendarDate | null>(initial ?? null);

    // `min-height: 100%` (not `100vh`) so the wrapper fills the canvas
    // in single-story view but stays bounded by the docs preview card.
    const outerStyle = [
      options.themeVars ?? '',
      'background: var(--ds-color-bg)',
      'color: var(--ds-color-text)',
      'min-height: 100%',
      'display: flex',
      'justify-content: center',
      'align-items: flex-start',
      'padding: 32px 24px',
    ]
      .filter(Boolean)
      .join('; ');

    const shellStyle =
      'width: 320px; min-height: 460px; display: flex; flex-direction: column; gap: 16px;';

    return { date, outerStyle, rest, shellStyle };
  },
  template: `
    <div :style="outerStyle">
      <div :style="shellStyle">
        <DatePicker v-bind="rest" v-model="date" />
        <code style="font-size: 12px; color: var(--ds-color-text-muted, #64748b);">
          v-model: {{ date ? date.year + '-' + String(date.month).padStart(2,'0') + '-' + String(date.day).padStart(2,'0') : 'null' }}
        </code>
      </div>
    </div>
  `,
});

export const Default: Story = {
  args: {
    label: 'Pick a date',
    locale: 'en-US',
    placeholder: 'Click to open',
  },
  render: (args) => Shell(args as Record<string, unknown>),
};

export const WithInitialValue: Story = {
  args: {
    ...Default.args,
    label: 'Departure',
    modelValue: { day: 18, month: 5, year: 2026 },
  },
  parameters: {
    docs: {
      description: {
        story: 'When `v-model` arrives pre-populated, the popover opens already focused on that date.',
      },
    },
  },
  render: (args) => Shell(args as Record<string, unknown>),
};

export const Localised: Story = {
  args: {
    ...Default.args,
    label: 'Escolha uma data',
    locale: 'pt-BR',
    placeholder: 'Selecione',
  },
  parameters: {
    docs: {
      description: {
        story:
          'Month and weekday labels come straight from `Intl.DateTimeFormat`, so any BCP 47 locale works out of the box.',
      },
    },
  },
  render: (args) => Shell(args as Record<string, unknown>),
};

export const Bounded: Story = {
  args: {
    ...Default.args,
    label: 'Within May 10-25, 2026',
    maxDate: { day: 25, month: 5, year: 2026 },
    minDate: { day: 10, month: 5, year: 2026 },
    modelValue: { day: 15, month: 5, year: 2026 },
  },
  parameters: {
    docs: {
      description: {
        story:
          'Cells outside `[minDate, maxDate]` are visually muted and unselectable (both by mouse and keyboard).',
      },
    },
  },
  render: (args) => Shell(args as Record<string, unknown>),
};

export const Disabled: Story = {
  args: {
    ...Default.args,
    disabled: true,
    label: 'Read-only',
    modelValue: { day: 18, month: 5, year: 2026 },
  },
  render: (args) => Shell(args as Record<string, unknown>),
};

export const LongFormat: Story = {
  args: {
    ...Default.args,
    displayFormat: { day: 'numeric', month: 'long', weekday: 'long', year: 'numeric' },
    label: 'Verbose format',
    modelValue: { day: 18, month: 5, year: 2026 },
  },
  parameters: {
    docs: {
      description: {
        story: 'The input label format is fully controlled via `Intl.DateTimeFormatOptions`.',
      },
    },
  },
  render: (args) => Shell(args as Record<string, unknown>),
};

/**
 * Override tokens *inline on the wrapper element*. Custom properties cascade
 * to descendants, so this is the most robust way to re-skin a component
 * without monkey-patching CSS or relying on framework-specific theming.
 */
const violetTheme = [
  '--ds-color-primary: #7c3aed',
  '--ds-color-primary-contrast: #ffffff',
  '--ds-color-primary-soft: #ede9fe',
  '--ds-color-focus-ring: rgba(124, 58, 237, 0.35)',
  '--ds-radius-sm: 12px',
  '--ds-radius-md: 14px',
  '--date-picker-cell-size: 40px',
].join('; ');

export const CustomTheme: Story = {
  args: {
    ...Default.args,
    label: 'Themed picker',
    modelValue: { day: 18, month: 5, year: 2026 },
  },
  parameters: {
    docs: {
      description: {
        story:
          'Re-skinning is overriding `--ds-*` and/or `--date-picker-*` tokens on any ancestor scope — here, inline on the wrapping `<div>`. The component itself never changes.',
      },
    },
  },
  render: (args) => Shell(args as Record<string, unknown>, { themeVars: violetTheme }),
};

const darkTheme = [
  '--ds-color-bg: #0f172a',
  '--ds-color-surface: #1e293b',
  '--ds-color-text: #f1f5f9',
  '--ds-color-text-muted: #94a3b8',
  '--ds-color-border: #334155',
  '--ds-color-hover: #334155',
  '--ds-color-primary: #60a5fa',
  '--ds-color-primary-contrast: #0f172a',
  '--ds-color-primary-soft: rgba(96, 165, 250, 0.18)',
  '--ds-color-focus-ring: rgba(96, 165, 250, 0.45)',
  '--ds-color-disabled: #475569',
  '--date-picker-color-today: #60a5fa',
].join('; ');

export const DarkTheme: Story = {
  args: {
    ...Default.args,
    label: 'Dark picker',
  },
  parameters: {
    docs: {
      description: {
        story:
          'Same component, all the dark-mode lift done with token overrides — no conditional logic inside the component. The wrapper models a themed app shell: tokens cascade from any ancestor.',
      },
    },
  },
  render: (args) => Shell(args as Record<string, unknown>, { themeVars: darkTheme }),
};

export const KeyboardNavigation: Story = {
  args: {
    ...Default.args,
    label: 'Try the keyboard',
  },
  parameters: {
    docs: {
      description: {
        story: `
Click the input, then explore:

| Key                       | Action                              |
| ------------------------- | ----------------------------------- |
| \`ArrowDown\` / Click       | Open popover                        |
| \`Esc\`                     | Close popover                       |
| \`←\` \`→\`                  | Previous / next day                 |
| \`↑\` \`↓\`                  | Previous / next week                |
| \`Home\` / \`End\`           | First / last day of month           |
| \`PageUp\` / \`PageDown\`    | Previous / next month               |
| \`Shift + PageUp/Down\`     | Previous / next year                |
| \`Enter\` / \`Space\`        | Select focused day                  |
| \`Tab\`                     | Close popover and move focus on     |
`,
      },
    },
  },
  render: (args) => Shell(args as Record<string, unknown>),
};
