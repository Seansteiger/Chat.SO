export type EmojiSetId = 'hybrid' | 'whatsapp' | 'telegram' | 'apple' | 'twemoji';

export interface EmojiSetDefinition {
  id: EmojiSetId;
  name: string;
  badge: string;
  description: string;
  cdnSource: 'apple' | 'google' | 'twemoji';
  emojis: string[];
}

export const EMOJI_HEX_MAP: Record<string, { appleGoogle: string; twemoji: string }> = {
  // Top Reactions
  '👍': { appleGoogle: '1f44d', twemoji: '1f44d' },
  '❤️': { appleGoogle: '2764-fe0f', twemoji: '2764' },
  '🔥': { appleGoogle: '1f525', twemoji: '1f525' },
  '😂': { appleGoogle: '1f602', twemoji: '1f602' },
  '🎉': { appleGoogle: '1f389', twemoji: '1f389' },
  '😮': { appleGoogle: '1f62e', twemoji: '1f62e' },
  '😢': { appleGoogle: '1f622', twemoji: '1f622' },
  '🙏': { appleGoogle: '1f64f', twemoji: '1f64f' },
  '💡': { appleGoogle: '1f4a1', twemoji: '1f4a1' },
  '✅': { appleGoogle: '2705', twemoji: '2705' },
  '👏': { appleGoogle: '1f44f', twemoji: '1f44f' },
  '🤔': { appleGoogle: '1f914', twemoji: '1f914' },
  '🤯': { appleGoogle: '1f92f', twemoji: '1f92f' },
  '😱': { appleGoogle: '1f631', twemoji: '1f631' },
  '👎': { appleGoogle: '1f44e', twemoji: '1f44e' },
  '‼️': { appleGoogle: '203c-fe0f', twemoji: '203c' },
  '❓': { appleGoogle: '2753', twemoji: '2753' },
  '✨': { appleGoogle: '2728', twemoji: '2728' },
  '🚀': { appleGoogle: '1f680', twemoji: '1f680' },
  '😍': { appleGoogle: '1f60d', twemoji: '1f60d' },
  '😁': { appleGoogle: '1f601', twemoji: '1f601' },

  // Expanded Pack (WhatsApp & Telegram favorites)
  '😊': { appleGoogle: '1f60a', twemoji: '1f60a' },
  '🥳': { appleGoogle: '1f973', twemoji: '1f973' },
  '🤩': { appleGoogle: '1f929', twemoji: '1f929' },
  '😎': { appleGoogle: '1f60e', twemoji: '1f60e' },
  '😴': { appleGoogle: '1f634', twemoji: '1f634' },
  '🤝': { appleGoogle: '1f91d', twemoji: '1f91d' },
  '💯': { appleGoogle: '1f4af', twemoji: '1f4af' },
  '💖': { appleGoogle: '1f496', twemoji: '1f496' },
  '💜': { appleGoogle: '1f49c', twemoji: '1f49c' },
  '💙': { appleGoogle: '1f499', twemoji: '1f499' },
  '🤍': { appleGoogle: '1f90d', twemoji: '1f90d' },
  '💀': { appleGoogle: '1f480', twemoji: '1f480' },
  '👻': { appleGoogle: '1f47b', twemoji: '1f47b' },
  '👀': { appleGoogle: '1f440', twemoji: '1f440' },
  '🙌': { appleGoogle: '1f64c', twemoji: '1f64c' },
  '✌️': { appleGoogle: '270c-fe0f', twemoji: '270c' },
  '🤞': { appleGoogle: '1f91e', twemoji: '1f91e' },
  '🫶': { appleGoogle: '1faf6', twemoji: '1faf6' },
  '🫡': { appleGoogle: '1fae1', twemoji: '1fae1' },
  '🤫': { appleGoogle: '1f92b', twemoji: '1f92b' },
  '☕': { appleGoogle: '2615', twemoji: '2615' },
  '🍕': { appleGoogle: '1f355', twemoji: '1f355' },
  '🍺': { appleGoogle: '1f37a', twemoji: '1f37a' },
  '⚡': { appleGoogle: '26a1', twemoji: '26a1' },
  '🌈': { appleGoogle: '1f308', twemoji: '1f308' },
  '🌟': { appleGoogle: '1f31f', twemoji: '1f31f' },
  '💎': { appleGoogle: '1f48e', twemoji: '1f48e' },
  '👑': { appleGoogle: '1f451', twemoji: '1f451' },
  '🎯': { appleGoogle: '1f3af', twemoji: '1f3af' },
  '🏆': { appleGoogle: '1f3c6', twemoji: '1f3c6' },
  '🎈': { appleGoogle: '1f388', twemoji: '1f388' },
  '🎁': { appleGoogle: '1f381', twemoji: '1f381' },
  '🎵': { appleGoogle: '1f3b5', twemoji: '1f3b5' },
};

export const EMOJI_SETS: Record<EmojiSetId, EmojiSetDefinition> = {
  hybrid: {
    id: 'hybrid',
    name: 'Modern Duo',
    badge: 'WhatsApp + Telegram',
    description: 'High-gloss Apple/WhatsApp 3D graphics with the curated top reactions from both apps',
    cdnSource: 'apple',
    emojis: ['👍', '❤️', '🔥', '😂', '🎉', '😮', '🙏', '💡', '✅'],
  },
  telegram: {
    id: 'telegram',
    name: 'Telegram Expressive',
    badge: 'Telegram Style',
    description: 'Energetic reaction set inspired by Telegram channels and group interactions',
    cdnSource: 'google',
    emojis: ['👍', '❤️', '🔥', '🎉', '👏', '😁', '🤔', '🤯', '😱', '🙏'],
  },
  whatsapp: {
    id: 'whatsapp',
    name: 'WhatsApp Signature',
    badge: 'WhatsApp Style',
    description: 'The iconic 6-reaction quick bar from WhatsApp with authentic glossy 3D artwork',
    cdnSource: 'apple',
    emojis: ['👍', '❤️', '😂', '😮', '😢', '🙏'],
  },
  apple: {
    id: 'apple',
    name: 'Apple / iOS Tapback',
    badge: 'iMessage Style',
    description: 'Crisp, minimalist iOS tapback set with heart, thumbs, and punctuation',
    cdnSource: 'apple',
    emojis: ['❤️', '👍', '👎', '😂', '‼️', '❓'],
  },
  twemoji: {
    id: 'twemoji',
    name: 'Twemoji Vector',
    badge: 'Twitter / X Style',
    description: 'Clean, flat vector aesthetic with vibrant colors and sharp geometric balance',
    cdnSource: 'twemoji',
    emojis: ['👍', '❤️', '🔥', '✨', '🚀', '🙏', '💡', '✅'],
  },
};

export const EMOJI_PICKER_CATEGORIES = [
  {
    name: 'Top Reactions',
    id: 'reactions',
    emojis: ['👍', '❤️', '🔥', '😂', '🎉', '😮', '🙏', '💡', '✅', '👏', '🤔', '🤯', '😱'],
  },
  {
    name: 'Smileys & Emotion',
    id: 'smileys',
    emojis: ['😊', '😂', '🥳', '🤩', '😎', '😮', '😢', '😴', '🤯', '😱', '🤫', '😍', '😁'],
  },
  {
    name: 'Hands & Gestures',
    id: 'gestures',
    emojis: ['👍', '👎', '👏', '🙏', '🤝', '🙌', '✌️', '🤞', '🫶', '🫡'],
  },
  {
    name: 'Hearts & Symbols',
    id: 'symbols',
    emojis: ['❤️', '💖', '💜', '💙', '🤍', '🔥', '✨', '🌟', '💯', '⚡', '💡', '✅', '‼️', '❓'],
  },
  {
    name: 'Fun & Objects',
    id: 'objects',
    emojis: ['🚀', '👑', '💎', '🎯', '🏆', '🎉', '🎈', '🎁', '🎵', '☕', '🍕', '🍺', '🌈', '💀', '👻', '👀'],
  },
];

/**
 * Returns the URL for an emoji.
 * Always resolves to local self-hosted assets first for instant, zero-latency, offline rendering.
 */
export function getEmojiUrl(emoji: string, cdnSource: 'apple' | 'google' | 'twemoji'): string | null {
  const map = EMOJI_HEX_MAP[emoji];
  if (!map) return null;

  switch (cdnSource) {
    case 'apple':
      return `/emojis/apple/${map.appleGoogle}.png`;
    case 'google':
      return `/emojis/google/${map.appleGoogle}.png`;
    case 'twemoji':
      return `/emojis/twemoji/${map.twemoji}.svg`;
    default:
      return `/emojis/apple/${map.appleGoogle}.png`;
  }
}

/**
 * Fallback CDN URL if needed
 */
export function getEmojiCdnFallback(emoji: string, cdnSource: 'apple' | 'google' | 'twemoji'): string | null {
  const map = EMOJI_HEX_MAP[emoji];
  if (!map) return null;

  switch (cdnSource) {
    case 'apple':
      return `https://cdn.jsdelivr.net/npm/emoji-datasource-apple@15.0.1/img/apple/64/${map.appleGoogle}.png`;
    case 'google':
      return `https://cdn.jsdelivr.net/npm/emoji-datasource-google@15.0.1/img/google/64/${map.appleGoogle}.png`;
    case 'twemoji':
      return `https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/svg/${map.twemoji}.svg`;
    default:
      return `https://cdn.jsdelivr.net/npm/emoji-datasource-apple@15.0.1/img/apple/64/${map.appleGoogle}.png`;
  }
}
