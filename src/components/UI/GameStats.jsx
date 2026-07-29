import React from 'react';

export function GameStats({ score, lives, multiplier, boxesFixed, comboCount, gameTime, formatTime }) {
  return (
    <div className="absolute top-24 left-0 right-0 flex justify-between items-center px-8 py-3 bg-black/60 text-white text-xl w-full z-30 backdrop-blur-sm border-b border-white/20">
      <div className="flex gap-8">
        <div className="flex flex-col items-center">
          <span className="text-xs opacity-80 uppercase tracking-wider">Счёт</span>
          <span className="text-3xl font-bold text-yellow-400 drop-shadow-lg">{score}</span>
        </div>
        <div className="flex flex-col items-center">
          <span className="text-xs opacity-80 uppercase tracking-wider">Множитель</span>
          <span className="text-3xl font-bold text-blue-400 drop-shadow-lg">
            x{multiplier === 1 ? '1' : multiplier.toFixed(1)}
          </span>
        </div>
        {comboCount > 0 && (
          <div className="flex flex-col items-center">
            <span className="text-xs opacity-80 uppercase tracking-wider">Комбо</span>
            <span className="text-3xl font-bold text-green-400 drop-shadow-lg">{comboCount}</span>
          </div>
        )}
        {gameTime !== undefined && formatTime && (
          <div className="flex flex-col items-center">
            <span className="text-xs opacity-80 uppercase tracking-wider">Время</span>
            <span className="text-3xl font-bold text-cyan-400 drop-shadow-lg">{formatTime(gameTime)}</span>
          </div>
        )}
      </div>
      <div className="flex gap-8">
        <div className="flex flex-col items-center">
          <span className="text-xs opacity-80 uppercase tracking-wider">Исправлено</span>
          <span className="text-3xl font-bold text-purple-400 drop-shadow-lg">{boxesFixed}</span>
        </div>
        <div className="flex flex-col items-center">
          <span className="text-xs opacity-80 uppercase tracking-wider">Жизни</span>
          <span className="text-3xl font-bold text-red-500 drop-shadow-lg">
            {'❤️'.repeat(lives)}
          </span>
        </div>
      </div>
    </div>
  );
}

export default GameStats;
