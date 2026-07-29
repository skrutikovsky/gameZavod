import React, { useState } from 'react';
import Menu from './components/Menu/Menu';
import LevelScreen from './components/LevelScreen/LevelScreen';
import Game from './components/Game/Game';

function App() {
  const [currentScreen, setCurrentScreen] = useState('menu');
  const [selectedLevel, setSelectedLevel] = useState(null);

  const handleStartGame = (level) => {
    setSelectedLevel(level);
    setCurrentScreen('game');
  };

  const handleBackToMenu = () => {
    setCurrentScreen('menu');
    setSelectedLevel(null);
  };

  const handleBackToLevels = () => {
    setCurrentScreen('levels');
  };

  return (
    <div className="app">
      {currentScreen === 'menu' && (
        <Menu onNavigate={(screen) => setCurrentScreen(screen)} />
      )}
      {currentScreen === 'levels' && (
        <LevelScreen 
          onSelectLevel={handleStartGame} 
          onBack={handleBackToMenu} 
        />
      )}
      {currentScreen === 'game' && selectedLevel && (
        <Game 
          level={selectedLevel} 
          onGameOver={handleBackToLevels}
          onBack={handleBackToMenu}
        />
      )}
    </div>
  );
}

export default App;
