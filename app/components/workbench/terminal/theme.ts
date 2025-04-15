import type { ITheme } from '@xterm/xterm';

const style = getComputedStyle(document.documentElement);
const cssVar = (token: string) => style.getPropertyValue(token) || undefined;

export function getTerminalTheme(overrides?: ITheme): ITheme {
  return {
    cursor: cssVar('--webai-elements-terminal-cursorColor'),
    cursorAccent: cssVar('--webai-elements-terminal-cursorColorAccent'),
    foreground: cssVar('--webai-elements-terminal-textColor'),
    background: cssVar('--webai-elements-terminal-backgroundColor'),
    selectionBackground: cssVar('--webai-elements-terminal-selection-backgroundColor'),
    selectionForeground: cssVar('--webai-elements-terminal-selection-textColor'),
    selectionInactiveBackground: cssVar('--webai-elements-terminal-selection-backgroundColorInactive'),

    // ansi escape code colors
    black: cssVar('--webai-elements-terminal-color-black'),
    red: cssVar('--webai-elements-terminal-color-red'),
    green: cssVar('--webai-elements-terminal-color-green'),
    yellow: cssVar('--webai-elements-terminal-color-yellow'),
    blue: cssVar('--webai-elements-terminal-color-blue'),
    magenta: cssVar('--webai-elements-terminal-color-magenta'),
    cyan: cssVar('--webai-elements-terminal-color-cyan'),
    white: cssVar('--webai-elements-terminal-color-white'),
    brightBlack: cssVar('--webai-elements-terminal-color-brightBlack'),
    brightRed: cssVar('--webai-elements-terminal-color-brightRed'),
    brightGreen: cssVar('--webai-elements-terminal-color-brightGreen'),
    brightYellow: cssVar('--webai-elements-terminal-color-brightYellow'),
    brightBlue: cssVar('--webai-elements-terminal-color-brightBlue'),
    brightMagenta: cssVar('--webai-elements-terminal-color-brightMagenta'),
    brightCyan: cssVar('--webai-elements-terminal-color-brightCyan'),
    brightWhite: cssVar('--webai-elements-terminal-color-brightWhite'),

    ...overrides,
  };
}
