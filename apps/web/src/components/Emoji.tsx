import React, { useState } from 'react';
import { EmojiSetId, EMOJI_SETS, getEmojiUrl } from '../constants/emojiSets.js';
import { useEmojiSet } from '../hooks/useEmojiSet.js';

interface EmojiProps {
  emoji: string;
  setId?: EmojiSetId;
  className?: string;
  fallbackClassName?: string;
}

export const Emoji: React.FC<EmojiProps> = ({
  emoji,
  setId,
  className = 'w-5 h-5 inline-block select-none pointer-events-none',
  fallbackClassName = 'text-sm inline-block select-none',
}) => {
  const { currentSet } = useEmojiSet();
  const setDefinition = setId ? EMOJI_SETS[setId] || currentSet : currentSet;
  const [hasError, setHasError] = useState(false);

  const url = getEmojiUrl(emoji, setDefinition.cdnSource);

  if (!url || hasError) {
    return <span className={fallbackClassName}>{emoji}</span>;
  }

  return (
    <img
      src={url}
      alt={emoji}
      loading="lazy"
      decoding="async"
      draggable={false}
      onError={() => setHasError(true)}
      className={`${className} object-contain`}
    />
  );
};
