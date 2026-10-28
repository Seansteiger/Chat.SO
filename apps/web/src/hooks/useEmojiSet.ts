import { useState, useEffect, useCallback } from 'react';
import { EmojiSetId, EMOJI_SETS, EmojiSetDefinition } from '../constants/emojiSets.js';

const STORAGE_KEY = 'chatso_emoji_set_v1';
const EVENT_KEY = 'chatso:emoji_set_changed';

export function useEmojiSet() {
  const [setId, setSetId] = useState<EmojiSetId>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(STORAGE_KEY) as EmojiSetId;
      if (saved && EMOJI_SETS[saved]) return saved;
    }
    return 'hybrid';
  });

  useEffect(() => {
    const handleCustomChange = (e: CustomEvent<EmojiSetId>) => {
      if (e.detail && EMOJI_SETS[e.detail]) {
        setSetId(e.detail);
      }
    };

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue && EMOJI_SETS[e.newValue as EmojiSetId]) {
        setSetId(e.newValue as EmojiSetId);
      }
    };

    window.addEventListener(EVENT_KEY as any, handleCustomChange);
    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener(EVENT_KEY as any, handleCustomChange);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  const changeSet = useCallback((newSetId: EmojiSetId) => {
    if (EMOJI_SETS[newSetId]) {
      setSetId(newSetId);
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, newSetId);
        window.dispatchEvent(new CustomEvent(EVENT_KEY, { detail: newSetId }));
      }
    }
  }, []);

  const currentSet: EmojiSetDefinition = EMOJI_SETS[setId] || EMOJI_SETS.hybrid;

  return {
    setId,
    currentSet,
    changeSet,
    availableSets: Object.values(EMOJI_SETS),
  };
}
