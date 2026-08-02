import React, { useEffect, useRef, useCallback } from 'react';
import { useGame4, WELD_PATTERNS, PATTERN_SCORES, SEAM_WIDTH_PERCENT } from '../../hooks/useGame4';
import { GameStats } from '../UI/GameStats';
import { Modal } from '../UI/Modal';
import { Button } from '../UI/Button';

const Game4 = ({ level, onGameOver, onBack, onLevelComplete }) => {
  const {
    gameState,
    startGame,
    stopGame,
    resetGame,
    handleMouseMove,
    handleMouseDown,
    handleMouseUp,
    nextRound,
    setCanvasRef,
    METAL_SHEET_WIDTH_PERCENT,
    METAL_SHEET_HEIGHT_PERCENT
  } = useGame4();

  const canvasRef = useRef(null);
  const requestRef = useRef(null);
  
  // Паттерны для отображения иконок
  const patternIcons = {
    [WELD_PATTERNS.STRAIGHT]: '➖',
    [WELD_PATTERNS.ZIGZAG]: '〰️',
    [WELD_PATTERNS.CIRCLES]: '🔵'
  };

  const patternNames = {
    [WELD_PATTERNS.STRAIGHT]: 'Прямой шов',
    [WELD_PATTERNS.ZIGZAG]: 'Змейка',
    [WELD_PATTERNS.CIRCLES]: 'Кружочки'
  };

  useEffect(() => {
    startGame();
    return () => {
      stopGame();
    };
  }, []);

  // Отрисовка на канвасе
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !gameState.seamPoints.length) return;

    const ctx = canvas.getContext('2d');
    const { width, height } = canvas;
    
    // Очищаем канвас
    ctx.clearRect(0, 0, width, height);

    const { 
      seamPoints, 
      patternPoints, 
      weldDots, 
      sheetX, 
      sheetY, 
      sheetWidth, 
      sheetHeight,
      currentPattern 
    } = gameState;

    // Рисуем лист металла
    const metalGradient = ctx.createLinearGradient(sheetX, sheetY, sheetX + sheetWidth, sheetY + sheetHeight);
    metalGradient.addColorStop(0, '#7f8c8d');
    metalGradient.addColorStop(0.5, '#95a5a6');
    metalGradient.addColorStop(1, '#7f8c8d');
    
    ctx.fillStyle = metalGradient;
    ctx.fillRect(sheetX, sheetY, sheetWidth, sheetHeight);
    
    // Добавляем текстуру металла
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)';
    ctx.lineWidth = 1;
    for (let i = 0; i < sheetHeight; i += 3) {
      ctx.beginPath();
      ctx.moveTo(sheetX, sheetY + i);
      ctx.lineTo(sheetX + sheetWidth, sheetY + i);
      ctx.stroke();
    }

    // Рисуем разрыв (шов)
    const seamWidth = sheetWidth * (SEAM_WIDTH_PERCENT / 100);
    
    // Область шва
    ctx.fillStyle = 'rgba(50, 50, 50, 0.3)';
    ctx.beginPath();
    
    // Верхняя граница шва
    for (let i = 0; i < seamPoints.length; i++) {
      const p = seamPoints[i];
      const x = sheetX + p.x;
      const y = sheetY + p.y - seamWidth / 2;
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    
    // Нижняя граница шва (в обратном направлении)
    for (let i = seamPoints.length - 1; i >= 0; i--) {
      const p = seamPoints[i];
      const x = sheetX + p.x;
      const y = sheetY + p.y + seamWidth / 2;
      ctx.lineTo(x, y);
    }
    
    ctx.closePath();
    ctx.fill();

    // Рисуем пунктирную линию паттерна
    if (patternPoints && patternPoints.length > 0) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      
      for (let i = 0; i < patternPoints.length; i++) {
        const p = patternPoints[i];
        const x = sheetX + p.x;
        const y = sheetY + p.y;
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Рисуем точки сварки игрока
    weldDots.forEach(dot => {
      const x = sheetX + dot.x;
      const y = sheetY + dot.y;
      
      // Градиент для точки сварки (эффект нагрева)
      const gradient = ctx.createRadialGradient(x, y, 0, x, y, seamWidth / 3);
      gradient.addColorStop(0, '#ff6b35');
      gradient.addColorStop(0.4, '#f7931e');
      gradient.addColorStop(1, '#ffd23f');
      
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(x, y, seamWidth / 3, 0, Math.PI * 2);
      ctx.fill();
      
      // Добавляем свечение
      ctx.shadowColor = '#ff6b35';
      ctx.shadowBlur = 10;
      ctx.fill();
      ctx.shadowBlur = 0;
    });

    // Рисуем границы листа
    ctx.strokeStyle = '#5d6d7e';
    ctx.lineWidth = 3;
    ctx.strokeRect(sheetX, sheetY, sheetWidth, sheetHeight);

  }, [gameState]);

  // Игровой цикл для отрисовки
  useEffect(() => {
    const animate = () => {
      draw();
      requestRef.current = requestAnimationFrame(animate);
    };
    
    requestRef.current = requestAnimationFrame(animate);
    
    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, [draw]);

  // Обработчики событий мыши
  const handleCanvasMouseDown = (e) => {
    handleMouseDown();
    handleMouseMove(e);
  };

  const handleCanvasMouseMove = (e) => {
    handleMouseMove(e);
  };

  const handleCanvasMouseUp = () => {
    handleMouseUp();
  };

  const handleCanvasMouseLeave = () => {
    handleMouseUp();
  };

  const handleRestart = () => {
    resetGame();
    startGame();
  };

  const handleNextRound = () => {
    nextRound();
  };

  const handleGameOver = () => {
    onGameOver();
  };

  const isRoundComplete = gameState.roundComplete;

  // Форматирование времени
  const formatTime = (ms) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  return (
    <div 
      className="game-container relative w-full h-screen overflow-hidden"
      onMouseDown={handleCanvasMouseDown}
      onMouseMove={handleCanvasMouseMove}
      onMouseUp={handleCanvasMouseUp}
      onMouseLeave={handleCanvasMouseLeave}
      style={{
        cursor: 'url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'32\' height=\'32\' viewBox=\'0 0 32 32\'><rect x=\'2\' y=\'10\' width=\'20\' height=\'12\' fill=\'%23555\' stroke=\'%23333\' stroke-width=\'2\'/><circle cx=\'24\' cy=\'16\' r=\'6\' fill=\'%23ff6b35\' stroke=\'%23f7931e\' stroke-width=\'2\'/></svg>") 16 16, auto'
      }}
    >
      {/* Статистика игры с кнопкой назад */}
      <GameStats
        score={gameState.totalScore}
        lives={3}
        boxesFixed={gameState.round}
        multiplier={1}
        comboCount={0}
        gameTime={0}
        formatTime={formatTime}
        onBack={onBack}
        isGame3={true}
        round={gameState.round}
        itemsOnBoard={gameState.seamProgress}
      />
      
      {/* Индикатор текущего паттерна и прогресса */}
      <div className="absolute top-20 left-1/2 transform -translate-x-1/2 bg-black/60 backdrop-blur-sm rounded-xl px-6 py-4 text-white z-20 border border-white/20">
        <div className="flex items-center gap-6">
          <div className="text-center">
            <span className="text-xs opacity-80 uppercase tracking-wider block">Тип шва</span>
            <span className="text-2xl font-bold">{patternIcons[gameState.currentPattern]} {patternNames[gameState.currentPattern]}</span>
          </div>
          <div className="text-center">
            <span className="text-xs opacity-80 uppercase tracking-wider block">Заполнение</span>
            <span className="text-2xl font-bold text-green-400">{gameState.seamProgress}%</span>
          </div>
          <div className="text-center">
            <span className="text-xs opacity-80 uppercase tracking-wider block">Качество</span>
            <span className={`text-2xl font-bold ${gameState.qualityPercent >= 80 ? 'text-green-400' : gameState.qualityPercent >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>
              {gameState.qualityPercent}%
            </span>
          </div>
          <div className="text-center">
            <span className="text-xs opacity-80 uppercase tracking-wider block">Очки за раунд</span>
            <span className="text-2xl font-bold text-yellow-400">
              {isRoundComplete ? `+${gameState.lastRoundScore}` : PATTERN_SCORES[gameState.currentPattern]}
            </span>
          </div>
        </div>
        
        {/* Прогресс бар заполнения шва */}
        <div className="mt-3 w-96 h-3 bg-gray-700 rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-orange-500 to-yellow-500 transition-all duration-300"
            style={{ width: `${gameState.seamProgress}%` }}
          />
        </div>
      </div>
      
      {/* Канвас для отрисовки */}
      <canvas
        ref={(ref) => {
          canvasRef.current = ref;
          setCanvasRef(ref);
        }}
        className="absolute inset-0 w-full h-full"
        width={window.innerWidth}
        height={window.innerHeight}
      />
      
      {/* Модальное окно завершения раунда */}
      {isRoundComplete && (
        <Modal
          title="Раунд завершен!"
          message={`Качество выполнения: ${gameState.qualityPercent}%\nОчки за раунд: ${gameState.lastRoundScore}\nОбщий счет: ${gameState.totalScore}`}
        >
          <div className="space-y-4">
            <Button onClick={handleNextRound} variant="primary">
              Следующий раунд
            </Button>
            <Button onClick={handleGameOver} variant="secondary">
              В главное меню
            </Button>
          </div>
        </Modal>
      )}
      
      {/* Подсказка внизу экрана */}
      <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 bg-black/60 backdrop-blur-sm rounded-xl px-6 py-3 text-white text-center z-20 border border-white/20">
        <p className="text-lg">
          🔥 Зажми ЛКМ и веди вдоль пунктирной линии чтобы заварить шов
        </p>
        <p className="text-sm opacity-80 mt-1">
          Используй паттерн "{patternNames[gameState.currentPattern]}" для максимального качества!
        </p>
      </div>
    </div>
  );
};

export default Game4;
