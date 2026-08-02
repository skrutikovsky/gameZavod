import React from 'react';

export function GameStats({ score, lives, multiplier, boxesFixed, comboCount, gameTime, formatTime, onBack, round, itemsOnBoard, isGame3 }) {
  return (
    <div className="absolute top-0 left-0 right-0 flex items-center px-4 py-3 bg-black/60 text-white text-xl w-full z-30 backdrop-blur-sm border-b border-white/20">
      {/* Кнопка назад слева */}
      <button
        onClick={onBack}
        className="w-10 h-10 bg-white/30 hover:bg-white/50 rounded-full flex items-center justify-center text-white text-xl font-bold transition-all mr-4 flex-shrink-0"
      >
        ←
      </button>
      
      {/* Статистика по центру - адаптирована под Game3 */}
      {isGame3 ? (
        <div className="flex-1 flex justify-center gap-6">
          <div className="flex flex-col items-center">
            <span className="text-xs opacity-80 uppercase tracking-wider">Счёт</span>
            <span className="text-2xl font-bold text-yellow-400 drop-shadow-lg">{score}</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-xs opacity-80 uppercase tracking-wider">Раунд</span>
            <span className="text-2xl font-bold text-blue-400 drop-shadow-lg">{round}</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-xs opacity-80 uppercase tracking-wider">Предметов</span>
            <span className="text-2xl font-bold text-green-400 drop-shadow-lg">{itemsOnBoard}</span>
          </div>
        </div>
      ) : (
        /* Стандартная статистика для Game1 и Game2 */
        <div className="flex-1 flex justify-center gap-6">
          <div className="flex flex-col items-center">
            <span className="text-xs opacity-80 uppercase tracking-wider">Счёт</span>
            <span className="text-2xl font-bold text-yellow-400 drop-shadow-lg">{score}</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-xs opacity-80 uppercase tracking-wider">Множитель</span>
            <span className="text-2xl font-bold text-blue-400 drop-shadow-lg">
              x{multiplier === 1 ? '1' : multiplier.toFixed(1)}
            </span>
          </div>
          {comboCount > 0 && (
            <div className="flex flex-col items-center">
              <span className="text-xs opacity-80 uppercase tracking-wider">Комбо</span>
              <span className="text-2xl font-bold text-green-400 drop-shadow-lg">{comboCount}</span>
            </div>
          )}
          {gameTime !== undefined && formatTime && (
            <div className="flex flex-col items-center">
              <span className="text-xs opacity-80 uppercase tracking-wider">Время</span>
              <span className="text-2xl font-bold text-cyan-400 drop-shadow-lg">{formatTime(gameTime)}</span>
            </div>
          )}
        </div>
      )}
      
      {/* Жизни и исправлено справа (только для Game1 и Game2) */}
      {!isGame3 && (
        <div className="flex gap-4 ml-4">
          <div className="flex flex-col items-center">
            <span className="text-xs opacity-80 uppercase tracking-wider">Исправлено</span>
            <span className="text-2xl font-bold text-purple-400 drop-shadow-lg">{boxesFixed}</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-xs opacity-80 uppercase tracking-wider">Жизни</span>
            <span className="text-2xl font-bold text-red-500 drop-shadow-lg">
              {'❤️'.repeat(lives)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

export default GameStats;
