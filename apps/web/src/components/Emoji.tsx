import React, { useState } from 'react';
import { EmojiSetId, EMOJI_SETS, getEmojiUrl, getEmojiCdnFallback } from '../constants/emojiSets.js';
import { useEmojiSet } from '../hooks/useEmojiSet.js';

interface EmojiProps {
  emoji: string;
  setId?: EmojiSetId;
  className?: string;
  fallbackClassName?: string;
  size?: number;
}

export const Emoji: React.FC<EmojiProps> = ({
  emoji,
  setId,
  className = 'w-5 h-5 inline-block select-none pointer-events-none shrink-0',
  fallbackClassName = 'text-base inline-block select-none leading-none shrink-0',
  size = 20,
}) => {
  const { currentSet } = useEmojiSet();
  const setDefinition = setId ? EMOJI_SETS[setId] || currentSet : currentSet;
  const [useCdnFallback, setUseCdnFallback] = useState(false);
  const [hasFatalError, setHasFatalError] = useState(false);

  // If fatal error, render native glyph
  if (hasFatalError) {
    return <span className={fallbackClassName}>{emoji}</span>;
  }

  const localUrl = getEmojiUrl(emoji, setDefinition.cdnSource);
  const cdnUrl = getEmojiCdnFallback(emoji, setDefinition.cdnSource);

  const activeSrc = useCdnFallback ? cdnUrl : localUrl;

  if (!activeSrc) {
    return <span className={fallbackClassName}>{emoji}</span>;
  }

  return (
    <img
      src={activeSrc}
      alt={emoji}
      width={size}
      height={size}
      loading="eager"
      decoding="async"
      draggable={false}
      onError={() => {
        if (!useCdnFallback && cdnUrl) {
          setUseCdnFallback(true);
        } else {
          setHasFatalError(true);
        }
      }}
      className={`${className} object-contain`}
    />
  );
};
