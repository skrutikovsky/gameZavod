import React from 'react';

export function GameStats({ score, lives, multiplier }) {
  return (
    <div className="flex justify-between items-center p-5 bg-black/50 text-white text-xl w-full">
      <div className="flex gap-8">
        <div className="flex flex-col items-center">
          <span className="text-sm opacity-80">Счёт</span>
          <span className="text-2xl font-bold text-yellow-400">{score}</span>
        </div>
        <div className="flex flex-col items-center">
          <span className="text-sm opacity-80">Множитель</span>
          <span className="text-2xl font-bold text-blue-400">
            x{multiplier === 1 ? '1' : multiplier.toFixed(1)}
          </span>
        </div>
      </div>
      <div className="flex flex-col items-center">
        <span className="text-sm opacity-80">Жизни</span>
        <span className="text-2xl font-bold text-red-500">
          {'❤️'.repeat(lives)}
        </span>
      </div>
    </div>
  );
}
