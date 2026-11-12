import { KeySpec, ShortcutSpec } from '@/types/types';

/** Modifiers arm themselves and are consumed by the next non-modifier key. */
export const MODIFIER_KEYS = new Set(['ctrl', 'alt', 'shift', 'win']);

/* ── Landscape rows ─────────────────────────────────────────────────────── */

export const NUMBER_ROW: KeySpec[] = [
  { label: '`', key: '`' },
  { label: '1', key: '1' },
  { label: '2', key: '2' },
  { label: '3', key: '3' },
  { label: '4', key: '4' },
  { label: '5', key: '5' },
  { label: '6', key: '6' },
  { label: '7', key: '7' },
  { label: '8', key: '8' },
  { label: '9', key: '9' },
  { label: '0', key: '0' },
  { label: '-', key: '-' },
  { label: '=', key: '=' },
  { label: 'BKSP', key: 'backspace', grow: 2, tone: 'accent' },
];

export const QWERTY_ROW: KeySpec[] = [
  { label: 'TAB', key: 'tab', grow: 1.5, tone: 'accent' },
  { label: 'Q', key: 'q' },
  { label: 'W', key: 'w' },
  { label: 'E', key: 'e' },
  { label: 'R', key: 'r' },
  { label: 'T', key: 't' },
  { label: 'Y', key: 'y' },
  { label: 'U', key: 'u' },
  { label: 'I', key: 'i' },
  { label: 'O', key: 'o' },
  { label: 'P', key: 'p' },
  { label: '[', key: '[' },
  { label: ']', key: ']' },
  { label: '\\', key: '\\', grow: 1.5, tone: 'accent' },
];

export const HOME_ROW: KeySpec[] = [
  { label: 'CAPS', key: 'capslock', grow: 1.6, tone: 'accent' },
  { label: 'A', key: 'a' },
  { label: 'S', key: 's' },
  { label: 'D', key: 'd' },
  { label: 'F', key: 'f' },
  { label: 'G', key: 'g' },
  { label: 'H', key: 'h' },
  { label: 'J', key: 'j' },
  { label: 'K', key: 'k' },
  { label: 'L', key: 'l' },
  { label: ';', key: ';' },
  { label: "'", key: "'" },
  { label: 'ENTER', key: 'enter', grow: 2.1, tone: 'primary' },
];

export const LETTER_ROW: KeySpec[] = [
  { label: 'SHIFT', key: 'shift', grow: 2.2, tone: 'modifier' },
  { label: 'Z', key: 'z' },
  { label: 'X', key: 'x' },
  { label: 'C', key: 'c' },
  { label: 'V', key: 'v' },
  { label: 'B', key: 'b' },
  { label: 'N', key: 'n' },
  { label: 'M', key: 'm' },
  { label: ',', key: ',' },
  { label: '.', key: '.' },
  { label: '/', key: '/' },
  { label: 'SHIFT', key: 'shift', grow: 2.2, tone: 'modifier' },
];

export const SPACE_ROW: KeySpec[] = [
  { label: 'CTRL', key: 'ctrl', grow: 1.4, tone: 'modifier' },
  { label: 'WIN', key: 'win', grow: 1.2, tone: 'modifier' },
  { label: 'ALT', key: 'alt', grow: 1.2, tone: 'modifier' },
  { label: 'SPACE', key: 'space', grow: 6, tone: 'accent' },
  { label: 'ALT', key: 'alt', grow: 1.2, tone: 'modifier' },
  { label: 'CTRL', key: 'ctrl', grow: 1.4, tone: 'modifier' },
  { label: '←', key: 'left' },
  { label: '↑', key: 'up' },
  { label: '↓', key: 'down' },
  { label: '→', key: 'right' },
];

/* ── Portrait rows ───────────────────────────────────────────────────────── */

export const PORTRAIT_NUMBER_ROW: KeySpec[] = [
  { label: '1', key: '1' },
  { label: '2', key: '2' },
  { label: '3', key: '3' },
  { label: '4', key: '4' },
  { label: '5', key: '5' },
  { label: '6', key: '6' },
  { label: '7', key: '7' },
  { label: '8', key: '8' },
  { label: '9', key: '9' },
  { label: '0', key: '0' },
];

export const PORTRAIT_QWERTY_ROW: KeySpec[] = [
  { label: 'Q', key: 'q' },
  { label: 'W', key: 'w' },
  { label: 'E', key: 'e' },
  { label: 'R', key: 'r' },
  { label: 'T', key: 't' },
  { label: 'Y', key: 'y' },
  { label: 'U', key: 'u' },
  { label: 'I', key: 'i' },
  { label: 'O', key: 'o' },
  { label: 'P', key: 'p' },
];

export const PORTRAIT_HOME_ROW: KeySpec[] = [
  { label: 'CAPS', key: 'capslock', grow: 1.5, tone: 'accent' },
  { label: 'A', key: 'a' },
  { label: 'S', key: 's' },
  { label: 'D', key: 'd' },
  { label: 'F', key: 'f' },
  { label: 'G', key: 'g' },
  { label: 'H', key: 'h' },
  { label: 'J', key: 'j' },
  { label: 'K', key: 'k' },
  { label: 'L', key: 'l' },
];

export const PORTRAIT_LETTER_ROW: KeySpec[] = [
  { label: 'SHIFT', key: 'shift', grow: 1.8, tone: 'modifier' },
  { label: 'Z', key: 'z' },
  { label: 'X', key: 'x' },
  { label: 'C', key: 'c' },
  { label: 'V', key: 'v' },
  { label: 'B', key: 'b' },
  { label: 'N', key: 'n' },
  { label: 'M', key: 'm' },
  { label: 'BKSP', key: 'backspace', grow: 1.8, tone: 'accent' },
];

export const PORTRAIT_SYMBOL_ROW_A: KeySpec[] = [
  { label: '`', key: '`' },
  { label: '-', key: '-' },
  { label: '=', key: '=' },
  { label: '[', key: '[' },
  { label: ']', key: ']' },
  { label: '\\', key: '\\' },
];

export const PORTRAIT_SYMBOL_ROW_B: KeySpec[] = [
  { label: ';', key: ';' },
  { label: "'", key: "'" },
  { label: ',', key: ',' },
  { label: '.', key: '.' },
  { label: '/', key: '/' },
];

export const PORTRAIT_ACTION_ROW: KeySpec[] = [
  { label: 'TAB', key: 'tab', grow: 1.2, tone: 'accent' },
  { label: 'CTRL', key: 'ctrl', grow: 1.2, tone: 'modifier' },
  { label: 'WIN', key: 'win', grow: 1.2, tone: 'modifier' },
  { label: 'ALT', key: 'alt', grow: 1.2, tone: 'modifier' },
  { label: 'SPACE', key: 'space', grow: 4, tone: 'accent' },
  { label: 'ALT', key: 'alt', grow: 1.2, tone: 'modifier' },
  { label: 'CTRL', key: 'ctrl', grow: 1.2, tone: 'modifier' },
  { label: 'ENTER', key: 'enter', grow: 1.6, tone: 'primary' },
];

export const PORTRAIT_ARROW_ROW: KeySpec[] = [
  { label: '←', key: 'left' },
  { label: '↑', key: 'up' },
  { label: '↓', key: 'down' },
  { label: '→', key: 'right' },
];

export const PRODUCTIVITY_SHORTCUTS: ShortcutSpec[] = [
  { label: 'COPY', icon: 'content-copy', key: 'c', modifiers: ['ctrl'] },
  { label: 'PASTE', icon: 'content-paste', key: 'v', modifiers: ['ctrl'] },
  { label: 'CUT', icon: 'content-cut', key: 'x', modifiers: ['ctrl'] },
  { label: 'UNDO', icon: 'undo', key: 'z', modifiers: ['ctrl'] },
  { label: 'REDO', icon: 'redo', key: 'y', modifiers: ['ctrl'] },
  { label: 'SELECT ALL', icon: 'select-all', key: 'a', modifiers: ['ctrl'] },
  { label: 'SAVE', icon: 'content-save', key: 's', modifiers: ['ctrl'] },
  { label: 'ALT+TAB', icon: 'application-outline', key: 'tab', modifiers: ['alt'], color: '#38BDF8' },
  { label: 'DESKTOP', icon: 'monitor', key: 'd', modifiers: ['win'], color: '#38BDF8' },
  { label: 'TASK MGR', icon: 'chart-box-outline', key: 'esc', modifiers: ['ctrl', 'shift'], color: '#F59E0B' },
  { label: 'LOCK', icon: 'lock-outline', key: 'l', modifiers: ['win'], color: '#F43F5E' },
];

export const UTILITY_KEYS: KeySpec[] = [
  { label: 'ESC', key: 'esc', tone: 'danger' },
  { label: 'F1', key: 'f1' },
  { label: 'F2', key: 'f2' },
  { label: 'F3', key: 'f3' },
  { label: 'F4', key: 'f4' },
  { label: 'F5', key: 'f5' },
  { label: 'F6', key: 'f6' },
  { label: 'F7', key: 'f7' },
  { label: 'F8', key: 'f8' },
  { label: 'F9', key: 'f9' },
  { label: 'F10', key: 'f10' },
  { label: 'F11', key: 'f11' },
  { label: 'F12', key: 'f12' },
  { label: 'DEL', key: 'delete', tone: 'danger' },
  { label: 'INS', key: 'insert' },
  { label: 'HOME', key: 'home' },
  { label: 'END', key: 'end' },
  { label: 'PGUP', key: 'pageup' },
  { label: 'PGDN', key: 'pagedown' },
];

export const LANDSCAPE_ROWS: KeySpec[][] = [
  NUMBER_ROW,
  QWERTY_ROW,
  HOME_ROW,
  LETTER_ROW,
  SPACE_ROW,
];

export const PORTRAIT_ROWS: KeySpec[][] = [
  PORTRAIT_NUMBER_ROW,
  PORTRAIT_QWERTY_ROW,
  PORTRAIT_HOME_ROW,
  PORTRAIT_LETTER_ROW,
  PORTRAIT_SYMBOL_ROW_A,
  PORTRAIT_SYMBOL_ROW_B,
  PORTRAIT_ACTION_ROW,
  PORTRAIT_ARROW_ROW,
];