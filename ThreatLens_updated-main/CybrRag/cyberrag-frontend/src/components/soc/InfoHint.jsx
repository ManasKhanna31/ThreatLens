import React, { useRef, useState } from 'react';

export default function InfoHint({ text, align = 'right' }) {
  const hintRef = useRef(null);
  const [bubbleStyle, setBubbleStyle] = useState(null);

  const positionBubble = () => {
    const rect = hintRef.current?.getBoundingClientRect();
    if (!rect) return;

    const width = 280;
    const viewportPadding = 14;
    const preferredLeft = align === 'left' ? rect.left : rect.right - width;
    const left = Math.min(
      Math.max(viewportPadding, preferredLeft),
      window.innerWidth - width - viewportPadding
    );
    const top = Math.min(rect.bottom + 10, window.innerHeight - 130);

    setBubbleStyle({ left, top, width });
  };

  return (
    <span
      ref={hintRef}
      className={`info-hint info-hint-${align}`}
      tabIndex={0}
      aria-label={text}
      onMouseEnter={positionBubble}
      onFocus={positionBubble}
    >
      <span className="info-hint-icon-wrapper">
        <svg className="info-hint-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      </span>
      <span className="info-hint-bubble" style={bubbleStyle || undefined}>{text}</span>
    </span>
  );
}
