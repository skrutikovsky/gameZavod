import React from 'react';

export function Box({ type, y, fixed, errorAnim, size = 100 }) {
  const getBoxClass = () => {
    if (errorAnim) return 'box error-anim';
    if (fixed) return 'box straight';
    if (type === 'tilted-left') return 'box tilted-left';
    if (type === 'tilted-right') return 'box tilted-right';
    return 'box straight';
  };
  
  const getContent = () => {
    if (fixed || errorAnim) return null;
    if (type === 'tilted-left') return '\u2199';
    if (type === 'tilted-right') return '\u2198';
    return null;
  };

  // Определяем цвет стрелки в зависимости от типа коробки
  const getArrowColor = () => {
    if (errorAnim) return '#ffffff';
    if (fixed) return '#ffffff';
    if (type === 'tilted-left') return '#ffffff';
    if (type === 'tilted-right') return '#ffffff';
    return '#ffffff';
  };

  return (
    <div
      className={getBoxClass()}
      style={{
        top: `${y}%`,
        width: `${size}px`,
        height: `${size}px`,
        fontSize: `${size / 2}px`,
        color: getArrowColor()
      }}
    >
      {getContent()}
    </div>
  );
}

export default Box;
