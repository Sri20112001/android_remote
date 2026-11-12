import { MaterialCommunityIcons } from '@expo/vector-icons';

export type SeekMode = 'web' | 'player';

export interface AudioStatus {
  level: number;
  muted: boolean;
}

export type KeyTone = 'default' | 'accent' | 'modifier' | 'primary' | 'danger';


export interface KeySpec {
  /** Text printed on the keycap. */
  label: string;
  /** Value sent to the agent in `key_tap`. */
  key: string;
  /** Width relative to the other keys in the same row. */
  grow?: number;
  tone?: KeyTone;
}

export interface ShortcutSpec {
  label: string;
  icon?: keyof typeof MaterialCommunityIcons.glyphMap;
  key: string;
  modifiers?: string[];
  color?: string;
}