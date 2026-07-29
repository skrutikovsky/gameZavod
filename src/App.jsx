import React, { useState } from 'react';
import Menu from './components/Menu/Menu';
import LevelScreen from './components/LevelScreen/LevelScreen';
import Game from './components/Game/Game';

function App() {
  const [currentScreen, setCurrentScreen] = useState('menu');
  const [selectedLevel, setSelectedLevel] = useState(null);
  const [lastCompletedLevel, setLastCompletedLevel] = useState(0);
  
  const handleStartGame = (level) => {
    setSelectedLevel(level);
    setCurrentScreen('game');
  };
  
  const handlePlayMiniGame = () => {
    setSelectedLevel(null); // Мини-игра без уровня
    setCurrentScreen('game');
  };

  const handleBackToMenu = () => {
    setCurrentScreen('menu');
    setSelectedLevel(null);
  };

  const handleBackToLevels = () => {
    setCurrentScreen('levels');
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
          onPlayMiniGame={handlePlayMiniGame}
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
        <Game 
          level={selectedLevel} 
          onGameOver={handleBackToLevels}
          onBack={handleBackToMenu}
          onLevelComplete={handleLevelComplete}
        />
      )}
    </div>
  );
}

export default App;
