import React from 'react';

export function Box({ type, y, fixed }) {
  const getBoxClass = () => {
    if (fixed) return 'box straight';
    if (type === 'tilted-left') return 'box tilted-left';
    if (type === 'tilted-right') return 'box tilted-right';
    return 'box straight';
  };

  const getContent = () => {
    if (fixed) return '';
    if (type === 'tilted-left') return '↙';
    if (type === 'tilted-right') return '↘';
    return '';
  };

  return (
    <div 
      className={getBoxClass()}
      style={{ top: `${y}px` }}
    >
      {getContent()}
    </div>
  );
}
