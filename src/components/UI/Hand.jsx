import React from 'react';

export function Hand({ position }) {
  return (
    <div className={`hand hand-${position}`}>
      <svg viewBox="0 0 100 120" xmlns="http://www.w3.org/2000/svg">
        <path 
          d="M20,60 Q10,50 15,30 Q20,10 40,5 Q60,10 65,30 Q70,50 60,60 L60,80 Q70,85 75,95 Q80,105 70,110 Q60,115 50,105 L50,80 L40,80 L40,105 Q30,115 20,110 Q10,105 15,95 Q20,85 30,80 L30,60 Z" 
          fill="#f39c12" 
          stroke="#d35400" 
          strokeWidth="3"
        />
        <circle cx="45" cy="40" r="8" fill="#e67e22" />
      </svg>
    </div>
  );
}
