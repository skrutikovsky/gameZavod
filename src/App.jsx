import React, { useState } from 'react';
import Menu from './components/Menu/Menu';
import LevelScreen from './components/LevelScreen/LevelScreen';
import Game from './components/Game/Game';
import Game2 from './components/Game2/Game2';
import Game3 from './components/Game3/Game3';
import Game4 from './components/Game4/Game4';

function App() {
  const [currentScreen, setCurrentScreen] = useState('menu');
  const [selectedLevel, setSelectedLevel] = useState(null);
  const [lastCompletedLevel, setLastCompletedLevel] = useState(0);
  
  const handleStartGame = (level) => {
    setSelectedLevel(level);
    setCurrentScreen('game');
  };

  const handleBackToMenu = () => {
    setCurrentScreen('menu');
    setSelectedLevel(null);
  };

  const handleBackToLevels = () => {
    setCurrentScreen('menu'); // Возвращаемся в главное меню с каруселью
  };
  
  const handleLevelComplete = (level) => {
    if (level > lastCompletedLevel) {
      setLastCompletedLevel(level);
    }
    setCurrentScreen('menu');
    setSelectedLevel(null);
  };

  return (
    <div className="app">
      {currentScreen === 'menu' && (
        <Menu 
          onSelectLevel={handleStartGame} 
          lastCompletedLevel={lastCompletedLevel}
        />
      )}
      {currentScreen === 'levels' && (
        <LevelScreen 
          onSelectLevel={handleStartGame} 
          onBack={handleBackToMenu} 
        />
      )}
      {currentScreen === 'game' && (
        selectedLevel === 1 ? (
          <Game 
            level={selectedLevel} 
            onGameOver={handleBackToLevels}
            onBack={handleBackToMenu}
            onLevelComplete={handleLevelComplete}
          />
        ) : selectedLevel === 2 ? (
          <Game2 
            level={selectedLevel} 
            onGameOver={handleBackToLevels}
            onBack={handleBackToMenu}
            onLevelComplete={handleLevelComplete}
          />
        ) : selectedLevel === 3 ? (
          <Game3 
            level={selectedLevel} 
            onGameOver={handleBackToLevels}
            onBack={handleBackToMenu}
            onLevelComplete={handleLevelComplete}
          />
        ) : selectedLevel === 4 ? (
          <Game4 
            level={selectedLevel} 
            onGameOver={handleBackToLevels}
            onBack={handleBackToMenu}
            onLevelComplete={handleLevelComplete}
          />
        ) : (
          <div className="game-container min-h-screen flex flex-col items-center justify-center p-4">
            <button
              onClick={handleBackToMenu}
              className="absolute top-5 left-5 z-40 w-12 h-12 bg-white/30 hover:bg-white/50 rounded-full flex items-center justify-center text-white text-2xl font-bold transition-all"
            >
              ←
            </button>
            <h1 className="text-6xl font-bold text-white drop-shadow-lg text-center">
              Это уровень {selectedLevel}
            </h1>
            <p className="text-2xl text-white/80 mt-4 text-center">
              Игра для этого уровня будет добавлена позже
            </p>
          </div>
        )
      )}
    </div>
  );
}

export default App;
