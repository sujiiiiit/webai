import { globSync } from 'fast-glob';
import fs from 'node:fs/promises';
import { basename } from 'node:path';
import { defineConfig, presetIcons, presetUno, transformerDirectives } from 'unocss';

const iconPaths = globSync('./icons/*.svg');

const collectionName = 'webai';

const customIconCollection = iconPaths.reduce(
  (acc, iconPath) => {
    const [iconName] = basename(iconPath).split('.');

    acc[collectionName] ??= {};
    acc[collectionName][iconName] = async () => fs.readFile(iconPath, 'utf8');

    return acc;
  },
  {} as Record<string, Record<string, () => Promise<string>>>,
);

const BASE_COLORS = {
  white: '#FFFFFF',
  gray: {
    50: '#FAFAFA',
    100: '#F5F5F5',
    200: '#E5E5E5',
    300: '#D4D4D4',
    400: '#A3A3A3',
    500: '#737373',
    600: '#525252',
    700: '#404040',
    800: '#262626',
    900: '#171717',
    950: '#0A0A0A',
  },
  accent: {
    50: '#F8F5FF',
    100: '#F0EBFF',
    200: '#E1D6FF',
    300: '#CEBEFF',
    400: '#B69EFF',
    500: '#9C7DFF',
    600: '#8A5FFF',
    700: '#7645E8',
    800: '#6234BB',
    900: '#502D93',
    950: '#2D1959',
  },
  green: {
    50: '#F0FDF4',
    100: '#DCFCE7',
    200: '#BBF7D0',
    300: '#86EFAC',
    400: '#4ADE80',
    500: '#22C55E',
    600: '#16A34A',
    700: '#15803D',
    800: '#166534',
    900: '#14532D',
    950: '#052E16',
  },
  orange: {
    50: '#FFFAEB',
    100: '#FEEFC7',
    200: '#FEDF89',
    300: '#FEC84B',
    400: '#FDB022',
    500: '#F79009',
    600: '#DC6803',
    700: '#B54708',
    800: '#93370D',
    900: '#792E0D',
  },
  red: {
    50: '#FEF2F2',
    100: '#FEE2E2',
    200: '#FECACA',
    300: '#FCA5A5',
    400: '#F87171',
    500: '#EF4444',
    600: '#DC2626',
    700: '#B91C1C',
    800: '#991B1B',
    900: '#7F1D1D',
    950: '#450A0A',
  },
};

const COLOR_PRIMITIVES = {
  ...BASE_COLORS,
  alpha: {
    white: generateAlphaPalette(BASE_COLORS.white),
    gray: generateAlphaPalette(BASE_COLORS.gray[900]),
    red: generateAlphaPalette(BASE_COLORS.red[500]),
  },
};

export default defineConfig({
  safelist: [...Object.keys(customIconCollection[collectionName] || {}).map((x) => `i-webai:${x}`)],
  shortcuts: {
    'webai-ease-cubic-bezier': 'ease-[cubic-bezier(0.4,0,0.2,1)]',
    'transition-theme': 'transition-[background-color,border-color,color] duration-150 webai-ease-cubic-bezier',
    kdb: 'bg-vs text-webai-elements-code-text py-1 px-1.5 rounded-md',
    'max-w-chat': 'max-w-[var(--chat-max-width)]',
  },

  rules: [
    /**
     * This shorthand doesn't exist in Tailwind and we overwrite it to avoid
     * any conflicts with minified CSS classes.
     */
    ['b', {}],
  ],
  theme: {
    colors: {
      ...COLOR_PRIMITIVES,
      light: 'var(--light)',
      messageContainer: 'var(--message-container)',
      primary: 'var(--text-primary)',
      secondary: 'var(--text-secondary)',
      accent: 'var(--accent)',
      vs: 'var(--vscode-background)',
      vsCode: 'var(--vscode-code-background)',
      background: 'var(--background)',
      color: {
        primary: 'var(--text-primary)',
        secondary: 'var(--text-secondary)',
      },

      webai: {
        elements: {
          borderColor: 'var(--webai-elements-borderColor)',
          borderColorActive: 'var(--webai-elements-borderColorActive)',
          background: {
            depth: {
              1: 'var(--webai-elements-bg-depth-1)',
              2: 'var(--webai-elements-bg-depth-2)',
              3: 'var(--webai-elements-bg-depth-3)',
              4: 'var(--webai-elements-bg-depth-4)',
            },
          },
          textPrimary: 'var(--webai-elements-textPrimary)',
          textSecondary: 'var(--webai-elements-textSecondary)',
          textTertiary: 'var(--webai-elements-textTertiary)',
          code: {
            background: 'var(--webai-elements-code-background)',
            text: 'var(--webai-elements-code-text)',
          },
          button: {
            primary: {
              background: 'var(--webai-elements-button-primary-background)',
              backgroundHover: 'var(--webai-elements-button-primary-backgroundHover)',
              text: 'var(--webai-elements-button-primary-text)',
            },
            secondary: {
              background: 'var(--webai-elements-button-secondary-background)',
              backgroundHover: 'var(--webai-elements-button-secondary-backgroundHover)',
              text: 'var(--webai-elements-button-secondary-text)',
            },
            danger: {
              background: 'var(--webai-elements-button-danger-background)',
              backgroundHover: 'var(--webai-elements-button-danger-backgroundHover)',
              text: 'var(--webai-elements-button-danger-text)',
            },
          },
          item: {
            contentDefault: 'var(--webai-elements-item-contentDefault)',
            contentActive: 'var(--blue-400)',
            contentAccent: 'var(--webai-elements-item-contentAccent)',
            contentDanger: 'var(--webai-elements-item-contentDanger)',
            backgroundDefault: 'var(--webai-elements-item-backgroundDefault)',
            backgroundActive: 'var(--webai-elements-item-backgroundActive)',
            backgroundAccent: 'var(--webai-elements-item-backgroundAccent)',
            backgroundDanger: 'var(--webai-elements-item-backgroundDanger)',
          },
          actions: {
            background: 'var(--webai-elements-actions-background)',
            code: {
              background: 'var(--webai-elements-actions-code-background)',
            },
          },
          artifacts: {
            background: 'var(--webai-elements-artifacts-background)',
            backgroundHover: 'var(--webai-elements-artifacts-backgroundHover)',
            borderColor: 'var(--webai-elements-artifacts-borderColor)',
            inlineCode: {
              background: 'var(--webai-elements-artifacts-inlineCode-background)',
              text: 'var(--webai-elements-artifacts-inlineCode-text)',
            },
          },
          messages: {
            background: 'var(--webai-elements-messages-background)',
            linkColor: 'var(--webai-elements-messages-linkColor)',
            code: {
              background: 'var(--webai-elements-messages-code-background)',
            },
            inlineCode: {
              background: 'var(--webai-elements-messages-inlineCode-background)',
              text: 'var(--webai-elements-messages-inlineCode-text)',
            },
          },
          icon: {
            success: 'var(--webai-elements-icon-success)',
            error: 'var(--webai-elements-icon-error)',
            primary: 'var(--webai-elements-icon-primary)',
            secondary: 'var(--webai-elements-icon-secondary)',
            tertiary: 'var(--webai-elements-icon-tertiary)',
          },
          preview: {
            addressBar: {
              background: 'var(--webai-elements-preview-addressBar-background)',
              backgroundHover: 'var(--webai-elements-preview-addressBar-backgroundHover)',
              backgroundActive: 'var(--webai-elements-preview-addressBar-backgroundActive)',
              text: 'var(--webai-elements-preview-addressBar-text)',
              textActive: 'var(--webai-elements-preview-addressBar-textActive)',
            },
          },
          terminals: {
            background: 'var(--webai-elements-terminals-background)',
            buttonBackground: 'var(--webai-elements-terminals-buttonBackground)',
          },
          dividerColor: 'var(--webai-elements-dividerColor)',
          loader: {
            background: 'var(--webai-elements-loader-background)',
            progress: 'var(--webai-elements-loader-progress)',
          },
          prompt: {
            background: 'var(--webai-elements-prompt-background)',
          },
          sidebar: {
            dropdownShadow: 'var(--webai-elements-sidebar-dropdownShadow)',
            buttonBackgroundDefault: 'var(--webai-elements-sidebar-buttonBackgroundDefault)',
            buttonBackgroundHover: 'var(--webai-elements-sidebar-buttonBackgroundHover)',
            buttonText: 'var(--webai-elements-sidebar-buttonText)',
          },
          cta: {
            background: 'var(--webai-elements-cta-background)',
            text: 'var(--webai-elements-cta-text)',
          },
        },
      },
    },
  },
  
  transformers: [transformerDirectives()],
  presets: [
    presetUno({
      dark: {
        light: '[data-theme="light"]',
        dark: '[data-theme="dark"]',
      },
    }),
    presetIcons({
      warn: true,
      collections: {
        ...customIconCollection,
      },
      unit: 'em',
    }),
  ],
});

/**
 * Generates an alpha palette for a given hex color.
 *
 * @param hex - The hex color code (without alpha) to generate the palette from.
 * @returns An object where keys are opacity percentages and values are hex colors with alpha.
 *
 * Example:
 *
 * ```
 * {
 *   '1': '#FFFFFF03',
 *   '2': '#FFFFFF05',
 *   '3': '#FFFFFF08',
 * }
 * ```
 */
function generateAlphaPalette(hex: string) {
  return [1, 2, 3, 4, 5, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100].reduce(
    (acc, opacity) => {
      const alpha = Math.round((opacity / 100) * 255)
        .toString(16)
        .padStart(2, '0');

      acc[opacity] = `${hex}${alpha}`;

      return acc;
    },
    {} as Record<number, string>,
  );
}
