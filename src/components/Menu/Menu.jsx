import React from 'react';

const Menu = ({ onNavigate }) => {
  return (
    <div className="game-container min-h-screen flex items-center justify-center p-4">
      <div className="text-center space-y-8">
        <h1 className="text-6xl font-bold text-white mb-8 drop-shadow-lg">
          Заводские Мини-Игры
        </h1>
        
        <div className="space-y-4">
          <button
            onClick={() => onNavigate('levels')}
            className="w-64 py-4 px-8 bg-green-500 hover:bg-green-600 text-white text-2xl font-bold rounded-xl shadow-lg transform hover:scale-105 transition-all duration-200"
          >
            Играть
          </button>
          
          <button
            onClick={() => onNavigate('settings')}
            className="w-64 py-4 px-8 bg-blue-500 hover:bg-blue-600 text-white text-2xl font-bold rounded-xl shadow-lg transform hover:scale-105 transition-all duration-200"
          >
            Настройки
          </button>
        </div>
      </div>
    </div>
  );
};

export default Menu;
