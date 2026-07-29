import React from 'react';

export function LevelItem({ level, isCompleted, isLocked, isSelected, onClick }) {
  const baseStyles = `
    w-30 h-30 
    bg-white/20 backdrop-blur-md 
    rounded-2xl 
    flex flex-col items-center justify-center 
    text-4xl font-bold text-white 
    cursor-pointer 
    shadow-lg 
    border-2 border-white/30
    absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2
    level-item
  `;

  const completedStyles = isCompleted ? 'level-item completed bg-green-500/60 border-green-500' : '';
  const lockedStyles = isLocked ? 'level-item locked opacity-50 cursor-not-allowed' : '';
  const selectedStyles = isSelected ? 'scale-100 opacity-100 z-10' : 'scale-[0.8] opacity-60';

  return (
    <div
      className={`${baseStyles} ${completedStyles} ${lockedStyles} ${selectedStyles}`}
      style={{ zIndex: isSelected ? 10 : 5 }}
      onClick={!isLocked ? onClick : undefined}
    >
      <span className="text-5xl font-bold">{level}</span>
      <span className="text-sm mt-1 opacity-90">Уровень</span>
    </div>
  );
}
