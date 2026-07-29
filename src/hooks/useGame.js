import { useState, useEffect, useCallback } from 'react';

const BOX_SIZE = 120;
const HAND_TOUCH_OFFSET = 30;
const INITIAL_LIVES = 3;
const BASE_CONVEYOR_SPEED = 2;
const BASE_SPAWN_RATE = 1500;

export function useGame() {
  const [gameState, setGameState] = useState({
    isRunning: false,
    score: 0,
    lives: INITIAL_LIVES,
    boxesFixed: 0,
    gameTime: 0,
    multiplier: 1,
    comboCount: 0,
    maxMultiplier: 1,
    conveyorSpeed: BASE_CONVEYOR_SPEED,
    spawnRate: BASE_SPAWN_RATE,
    handPosition: 'left',
    boxes: [],
    lastSpawnTime: 0
  });

  const [gameLoopId, setGameLoopId] = useState(null);

  const resetGame = useCallback(() => {
    setGameState({
      isRunning: false,
      score: 0,
      lives: INITIAL_LIVES,
      boxesFixed: 0,
      gameTime: 0,
      multiplier: 1,
      comboCount: 0,
      maxMultiplier: 1,
      conveyorSpeed: BASE_CONVEYOR_SPEED,
      spawnRate: BASE_SPAWN_RATE,
      handPosition: 'left',
      boxes: [],
      lastSpawnTime: 0
    });
  }, []);

  const moveHand = useCallback((position) => {
    setGameState(prev => ({
      ...prev,
      handPosition: position
    }));
  }, []);

  const spawnBox = useCallback(() => {
    const randomType = Math.random();
    let boxType;
    
    if (randomType < 0.3) {
      boxType = 'straight';
    } else if (randomType < 0.65) {
      boxType = 'tilted-left';
    } else {
      boxType = 'tilted-right';
    }

    return {
      id: Date.now() + Math.random(),
      type: boxType,
      y: 60,
      fixed: false,
      checked: false
    };
  }, []);

  const fixBox = useCallback((boxId) => {
    setGameState(prev => {
      const boxes = prev.boxes.map(box => 
        box.id === boxId 
          ? { ...box, fixed: true, checked: true, type: 'straight' }
          : box
      );

      const newComboCount = prev.comboCount + 1;
      let newMultiplier = 1;
      
      if (newComboCount >= 30) {
        newMultiplier = 2;
      } else if (newComboCount >= 10) {
        newMultiplier = 1.5;
      }

      return {
        ...prev,
        boxes,
        boxesFixed: prev.boxesFixed + 1,
        comboCount: newComboCount,
        multiplier: newMultiplier,
        maxMultiplier: Math.max(prev.maxMultiplier, newMultiplier),
        score: prev.score + Math.floor(100 * newMultiplier)
      };
    });
  }, []);

  const loseLife = useCallback(() => {
    setGameState(prev => ({
      ...prev,
      lives: prev.lives - 1,
      comboCount: 0,
      multiplier: 1
    }));
  }, []);

  const updateBoxes = useCallback((beltHeight, deltaTime) => {
    setGameState(prev => {
      const fixZoneStart = beltHeight - 180;
      const fixZoneEnd = beltHeight - 60;
      let livesLost = 0;

      const updatedBoxes = prev.boxes
        .map(box => {
          const newY = box.y + prev.conveyorSpeed;
          
          if ((box.type === 'tilted-left' || box.type === 'tilted-right') && !box.fixed && !box.checked) {
            if (newY >= fixZoneStart && newY <= fixZoneEnd) {
              const correctHand = box.type === 'tilted-left' ? 'right' : 'left';
              
              if (prev.handPosition === correctHand) {
                const newComboCount = prev.comboCount + 1;
                let newMultiplier = 1;
                
                if (newComboCount >= 30) {
                  newMultiplier = 2;
                } else if (newComboCount >= 10) {
                  newMultiplier = 1.5;
                }

                return {
                  ...box,
                  y: newY,
                  fixed: true,
                  checked: true,
                  type: 'straight'
                };
              }
            }
          }
          
          return { ...box, y: newY };
        })
        .filter(box => {
          if (box.y > beltHeight - 20) {
            if (box.type === 'tilted-left' || box.type === 'tilted-right') {
              livesLost++;
            }
            return false;
          }
          return true;
        });

      let newLives = prev.lives - livesLost;
      let gameOver = false;
      
      if (newLives <= 0) {
        newLives = 0;
        gameOver = true;
      }

      return {
        ...prev,
        boxes: updatedBoxes,
        lives: newLives,
        comboCount: livesLost > 0 ? 0 : prev.comboCount,
        multiplier: livesLost > 0 ? 1 : prev.multiplier,
        isRunning: !gameOver
      };
    });
  }, []);

  const startGame = useCallback(() => {
    resetGame();
    setGameState(prev => ({
      ...prev,
      isRunning: true,
      lastSpawnTime: performance.now()
    }));
  }, [resetGame]);

  const stopGame = useCallback(() => {
    if (gameLoopId) {
      cancelAnimationFrame(gameLoopId);
    }
    setGameState(prev => ({
      ...prev,
      isRunning: false
    }));
  }, [gameLoopId]);

  return {
    gameState,
    setGameState,
    moveHand,
    fixBox,
    loseLife,
    updateBoxes,
    spawnBox,
    startGame,
    stopGame,
    resetGame
  };
}
