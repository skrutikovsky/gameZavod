import React from 'react';

export function Box({ type, y, fixed, errorAnim, size = 100, originalType }) {
  const getBoxClass = () => {
    if (errorAnim) return 'box error-anim';
    if (fixed) return 'box straight';
    if (type === 'tilted-left') return 'box tilted-left';
    if (type === 'tilted-right') return 'box tilted-right';
    return 'box straight';
  };
  
  // Для анимации ошибки используем оригинальный тип коробки
  const displayType = errorAnim && originalType ? originalType : type;
  
  const getContent = () => {
    if (fixed || errorAnim) return null;
    if (displayType === 'tilted-left') return '\u2199';
    if (displayType === 'tilted-right') return '\u2198';
    return null;
  };

  // Определяем цвет стрелки в зависимости от типа коробки
  const getArrowColor = () => {
    if (errorAnim) return '#ffffff';
    if (fixed) return '#ffffff';
    if (displayType === 'tilted-left') return '#ffffff';
    if (displayType === 'tilted-right') return '#ffffff';
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
      {/* Убрали номера коробок - теперь только стрелка */}
      {getContent()}
    </div>
  );
}

export default Box;
