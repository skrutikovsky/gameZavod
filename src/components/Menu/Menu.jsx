import React, { useState } from 'react';

const Menu = ({ onSelectLevel }) => {
  const levels = [1, 2, 3, 4, 5];
  const [currentIndex, setCurrentIndex] = useState(2); // Центральный элемент
  
  const handlePrev = () => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : prev));
  };
  
  const handleNext = () => {
    setCurrentIndex((prev) => (prev < levels.length - 1 ? prev + 1 : prev));
  };
  
  const handleSelect = () => {
    onSelectLevel(levels[currentIndex]);
  };

  return (
    <div className="game-container min-h-screen flex flex-col items-center justify-center p-4">
      <h1 className="text-5xl md:text-6xl font-bold text-white mb-8 drop-shadow-lg text-center">
        Заводские Мини-Игры
      </h1>
      
      {/* Карусель уровней */}
      <div className="relative w-full max-w-2xl h-80 overflow-hidden mb-8">
        {/* Стрелка влево */}
        <button
          onClick={handlePrev}
          disabled={currentIndex === 0}
          className={`absolute left-0 top-1/2 -translate-y-1/2 z-20 w-16 h-16 bg-white/30 hover:bg-white/50 rounded-full flex items-center justify-center text-white text-3xl font-bold transition-all ${
            currentIndex === 0 ? 'opacity-30 cursor-not-allowed' : 'opacity-100 cursor-pointer'
          }`}
        >
          ‹
        </button>
        
        {/* Стрелка вправо */}
        <button
          onClick={handleNext}
          disabled={currentIndex === levels.length - 1}
          className={`absolute right-0 top-1/2 -translate-y-1/2 z-20 w-16 h-16 bg-white/30 hover:bg-white/50 rounded-full flex items-center justify-center text-white text-3xl font-bold transition-all ${
            currentIndex === levels.length - 1 ? 'opacity-30 cursor-not-allowed' : 'opacity-100 cursor-pointer'
          }`}
        >
          ›
        </button>
        
        {/* Контейнер карусели */}
        <div className="carousel-mask relative w-full h-full">
          <div 
            className="flex items-center justify-center h-full transition-transform duration-300 ease-out"
            style={{ 
              transform: `translateX(calc(-${currentIndex * 200}px + 50% - 100px))`
            }}
          >
            {levels.map((level, index) => {
              const offset = index - currentIndex;
              const isActive = offset === 0;
              const scale = isActive ? 1 : 0.75;
              const opacity = isActive ? 1 : 0.5;
              const zIndex = isActive ? 10 : 5;
              
              return (
                <div
                  key={level}
                  className={`
                    w-48 h-48
                    bg-white/20 backdrop-blur-md
                    rounded-2xl
                    flex flex-col items-center justify-center
                    text-5xl font-bold text-white
                    shadow-lg
                    border-2 border-white/30
                    transition-all duration-300
                    absolute
                  `}
                  style={{ 
                    transform: `translateX(${offset * 220}px) scale(${scale})`,
                    opacity,
                    zIndex
                  }}
                >
                  <span className="text-6xl font-bold">{level}</span>
                  <span className="text-sm mt-2 opacity-90">Уровень</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      
      {/* Кнопка выбора уровня */}
      <button
        onClick={handleSelect}
        className="w-64 py-4 px-8 bg-green-500 hover:bg-green-600 text-white text-2xl font-bold rounded-xl shadow-lg transform hover:scale-105 transition-all duration-200"
      >
        Играть Уровень {levels[currentIndex]}
      </button>
    </div>
  );
};

export default Menu;
