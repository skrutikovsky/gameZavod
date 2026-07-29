import React, { useState } from 'react';

const TOTAL_LEVELS = 10;

const LevelScreen = ({ onSelectLevel, onBack }) => {
  const levels = Array.from({ length: TOTAL_LEVELS }, (_, i) => i + 1);
  const [selectedLevel, setSelectedLevel] = useState(null);

  const handleSelectLevel = (level) => {
    setSelectedLevel(level);
    setTimeout(() => {
      onSelectLevel(level);
    }, 300);
  };

  return (
    <div className="game-container min-h-screen flex flex-col items-center justify-center p-4">
      <button
        onClick={onBack}
        className="absolute top-4 left-4 py-2 px-4 bg-white/20 hover:bg-white/30 text-white rounded-lg transition-all"
      >
        ← Назад
      </button>

      <h2 className="text-4xl font-bold text-white mb-8 drop-shadow-lg">
        Выберите уровень
      </h2>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {levels.map((level) => (
          <div
            key={level}
            className={`
              w-32 h-32
              bg-white/20 backdrop-blur-md
              rounded-2xl
              flex flex-col items-center justify-center
              text-4xl font-bold text-white
              cursor-pointer
              shadow-lg
              border-2 border-white/30
              transition-all duration-300
              ${selectedLevel === level ? 'scale-110 opacity-100 bg-white/40' : 'hover:scale-105'}
            `}
            onClick={() => handleSelectLevel(level)}
          >
            <span className="text-5xl font-bold">{level}</span>
            <span className="text-sm mt-1 opacity-90">Уровень</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default LevelScreen;
