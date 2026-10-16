'use client';

import React, { useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { Theme, EmojiStyle } from 'emoji-picker-react';
import { X, Trash2, Shuffle, Smile } from 'lucide-react';

// Dynamically import emoji-picker-react for clean SSR compatibility
const Picker = dynamic(() => import('emoji-picker-react'), {
  ssr: false,
  loading: () => (
    <div className="w-[320px] h-[360px] flex flex-col items-center justify-center gap-2 text-xs text-text-muted bg-surface-panel rounded-lg">
      <Smile className="w-6 h-6 animate-pulse text-primary" />
      <span>Loading emojis...</span>
    </div>
  ),
});

const CURATED_RANDOM_EMOJIS = [
  '🚀', '📝', '🔒', '⚡', '💡', '🔥', '💻', '🛠️', '⚙️', '🛡️',
  '📦', '🔍', '🎯', '🎨', '📚', '🌟', '💎', '🔑', '🏷️', '📊',
  '☕', '🤖', '🌐', '📡', '🧪', '🌱', '📑', '🧭', '🔮', '🕹️',
  '🧠', '🧩', '📈', '📌', '📎', '📜', '📁', '💼', '🏆', '🎉'
];

interface DocumentEmojiPickerProps {
  currentIcon?: string | null;
  onSelect: (emoji: string) => void;
  onRemove: () => void;
  onClose: () => void;
  className?: string;
}

export function DocumentEmojiPicker({
  currentIcon,
  onSelect,
  onRemove,
  onClose,
  className = '',
}: DocumentEmojiPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on Escape or click outside
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  const handleRandom = () => {
    const randomEmoji = CURATED_RANDOM_EMOJIS[Math.floor(Math.random() * CURATED_RANDOM_EMOJIS.length)];
    onSelect(randomEmoji);
  };

  return (
    <div
      ref={containerRef}
      className={`bg-surface-panel border border-border-muted rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.85)] z-50 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-100 ${className}`}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Top Header & Actions Bar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border-subtle bg-surface-subtle text-xs">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleRandom}
            className="flex items-center gap-1 px-2 py-1 rounded bg-surface hover:bg-surface-raised border border-border-subtle text-text-secondary hover:text-text-primary text-[11px] font-label-mono transition-colors"
            title="Pick a random emoji"
          >
            <Shuffle className="w-3 h-3 text-primary" />
            <span>Random</span>
          </button>

          {currentIcon && (
            <button
              type="button"
              onClick={() => {
                onRemove();
                onClose();
              }}
              className="flex items-center gap-1 px-2 py-1 rounded bg-status-danger/10 hover:bg-status-danger/20 border border-status-danger/30 text-status-danger text-[11px] font-label-mono transition-colors"
              title="Remove document icon"
            >
              <Trash2 className="w-3 h-3" />
              <span>Remove</span>
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-surface-raised transition-colors"
          aria-label="Close emoji picker"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Emoji Picker Body */}
      <div className="p-1.5 [&_.epr-main]:!bg-transparent [&_.epr-main]:!border-none [&_.epr-header]:!border-border-subtle [&_.epr-search-container]:!bg-surface-raised [&_.epr-search-container_input]:!bg-surface-raised [&_.epr-category-nav]:!border-border-subtle">
        <Picker
          theme={Theme.DARK}
          emojiStyle={EmojiStyle.NATIVE}
          searchPlaceHolder="Search emoji..."
          previewConfig={{ showPreview: false }}
          width={320}
          height={380}
          lazyLoadEmojis={true}
          onEmojiClick={(emojiData) => {
            onSelect(emojiData.emoji);
            onClose();
          }}
        />
      </div>
    </div>
  );
}
