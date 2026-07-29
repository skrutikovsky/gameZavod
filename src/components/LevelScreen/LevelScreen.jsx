import React from 'react';

const LevelScreen = ({ onSelectLevel, onBack }) => {
  const levels = [1, 2, 3, 4, 5];
  const [selectedLevel, setSelectedLevel] = React.useState(null);

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

      <div className="carousel-mask relative w-full max-w-md h-96 overflow-hidden">
        <div className="relative h-full">
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
                absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2
                level-item
                ${selectedLevel === level ? 'scale-100 opacity-100 z-10' : 'scale-[0.8] opacity-60'}
              `}
              style={{ zIndex: selectedLevel === level ? 10 : 5 }}
              onClick={() => handleSelectLevel(level)}
            >
              <span className="text-5xl font-bold">{level}</span>
              <span className="text-sm mt-1 opacity-90">Уровень</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default LevelScreen;
