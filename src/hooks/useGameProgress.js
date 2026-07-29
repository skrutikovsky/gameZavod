import { useState, useEffect } from 'react';

const TOTAL_LEVELS = 10;

export function useGameProgress() {
  const [completedLevels, setCompletedLevels] = useState(() => {
    const saved = localStorage.getItem('factoryGameProgress');
    if (saved) {
      const data = JSON.parse(saved);
      return data.completedLevels || [];
    }
    return [];
  });

  const [currentLevel, setCurrentLevel] = useState(() => {
    const saved = localStorage.getItem('factoryGameProgress');
    if (saved) {
      const data = JSON.parse(saved);
      return findFirstUncompletedLevel(data.completedLevels || []);
    }
    return 1;
  });

  useEffect(() => {
    localStorage.setItem('factoryGameProgress', JSON.stringify({
      completedLevels
    }));
  }, [completedLevels]);

  const completeLevel = (level) => {
    if (!completedLevels.includes(level)) {
      setCompletedLevels(prev => [...prev, level].sort((a, b) => a - b));
    }
  };

  const isLevelCompleted = (level) => completedLevels.includes(level);

  const isLevelUnlocked = (level) => {
    return level === 1 || completedLevels.includes(level - 1);
  };

  const findFirstUncompletedLevel = (levels) => {
    for (let i = 1; i <= TOTAL_LEVELS; i++) {
      if (!levels.includes(i)) {
        return i;
      }
    }
    return TOTAL_LEVELS;
  };

  return {
    totalLevels: TOTAL_LEVELS,
    completedLevels,
    currentLevel,
    setCurrentLevel,
    completeLevel,
    isLevelCompleted,
    isLevelUnlocked
  };
}
