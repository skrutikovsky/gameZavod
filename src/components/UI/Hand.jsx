import React from 'react';

export function Hand({ position }) {
  return (
    <div className={`hand hand-${position}`}>
      <svg viewBox="0 0 100 120" xmlns="http://www.w3.org/2000/svg">
        {/* Пальцы */}
        <g fill="#f39c12" stroke="#d35400" strokeWidth="2">
          {/* Указательный палец */}
          <rect x="42" y="10" width="16" height="45" rx="8" />
          {/* Средний палец */}
          <rect x="28" y="15" width="14" height="42" rx="7" />
          {/* Безымянный палец */}
          <rect x="58" y="15" width="14" height="42" rx="7" />
          {/* Мизинец */}
          <rect x="15" y="25" width="12" height="35" rx="6" />
          {/* Большой палец */}
          <ellipse cx="75" cy="50" rx="10" ry="20" transform="rotate(30 75 50)" />
        </g>
        
        {/* Ладонь */}
        <ellipse cx="50" cy="65" rx="28" ry="25" fill="#f39c12" stroke="#d35400" strokeWidth="2" />
        
        {/* Детали ладони */}
        <path d="M40 60 Q50 70 60 60" stroke="#d35400" strokeWidth="2" fill="none" opacity="0.5" />
        <path d="M42 70 L42 80 M50 70 L50 82 M58 70 L58 80" stroke="#d35400" strokeWidth="2" fill="none" opacity="0.4" />
        
        {/* Блестящие детали */}
        <ellipse cx="45" cy="40" r="5" fill="#f1c40f" opacity="0.6" />
      </svg>
    </div>
  );
}

export default Hand;
