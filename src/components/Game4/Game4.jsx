import React, { useEffect, useRef, useCallback } from 'react';
import { useGame4, WELD_RADIUS, GAP_WIDTH, MAX_WELD_POINTS } from '../../hooks/useGame4';
import { GameStats } from '../UI/GameStats';
import { Modal } from '../UI/Modal';
import { Button } from '../UI/Button';

const Game4 = ({ level, onGameOver, onBack, onLevelComplete }) => {
  const {
    gameState,
    startGame,
    resetGame,
    handleMouseMove,
    handleMouseDown,
    handleMouseUp,
    nextRound,
    setCanvasRef,
    initRound,
    MAX_WELD_POINTS,
    WELD_RADIUS,
    GAP_WIDTH
  } = useGame4();
  
  const canvasRef = useRef(null);
  const requestRef = useRef(null);

  useEffect(() => {
    startGame();
    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, []);

  // Отрисовка на канвасе
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !gameState.gapPath.length) return;

    const ctx = canvas.getContext('2d');
    const { width, height } = canvas;
    
    // Очищаем канвас
    ctx.clearRect(0, 0, width, height);

    const { gapPath, weldPoints, cooledPoints } = gameState;
    
    // Параметры листа металла
    const sheetMargin = 40;
    const sheetX = sheetMargin;
    const sheetY = sheetMargin;
    const sheetWidth = width - sheetMargin * 2;
    const sheetHeight = height - sheetMargin * 2;

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
    const seamWidth = GAP_WIDTH;
    
    // Область шва
    ctx.fillStyle = 'rgba(50, 50, 50, 0.4)';
    ctx.beginPath();
    
    // Верхняя граница шва
    for (let i = 0; i < gapPath.length; i++) {
      const p = gapPath[i];
      const x = sheetX + p.x;
      const y = sheetY + p.y - seamWidth / 2;
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    
    // Нижняя граница шва (в обратном направлении)
    for (let i = gapPath.length - 1; i >= 0; i--) {
      const p = gapPath[i];
      const x = sheetX + p.x;
      const y = sheetY + p.y + seamWidth / 2;
      ctx.lineTo(x, y);
    }
    
    ctx.closePath();
    ctx.fill();

    // Рисуем охлажденные точки сварки (серые)
    cooledPoints.forEach(dot => {
      const x = sheetX + dot.x;
      const y = sheetY + dot.y;
      
      ctx.fillStyle = '#6b7280';
      ctx.beginPath();
      ctx.arc(x, y, WELD_RADIUS, 0, Math.PI * 2);
      ctx.fill();
      
      // Темная обводка для охлажденных точек
      ctx.strokeStyle = '#4b5563';
      ctx.lineWidth = 1;
      ctx.stroke();
    });

    // Рисуем горячие точки сварки игрока (оранжевые со свечением)
    weldPoints.forEach(dot => {
      const x = sheetX + dot.x;
      const y = sheetY + dot.y;
      
      // Градиент для точки сварки (эффект нагрева)
      const gradient = ctx.createRadialGradient(x, y, 0, x, y, WELD_RADIUS);
      gradient.addColorStop(0, '#ff6b35');
      gradient.addColorStop(0.4, '#f7931e');
      gradient.addColorStop(1, '#ffd23f');
      
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(x, y, WELD_RADIUS, 0, Math.PI * 2);
      ctx.fill();
      
      // Добавляем свечение
      ctx.shadowColor = '#ff6b35';
      ctx.shadowBlur = 15;
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
  const isGameOver = gameState.gameOver;
  const weldPercent = Math.round((gameState.weldUsed / MAX_WELD_POINTS) * 100);

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
        score={gameState.score}
        lives={3}
        boxesFixed={gameState.round}
        multiplier={1}
        comboCount={0}
        gameTime={0}
        formatTime={(ms) => '0:00'}
        onBack={onBack}
        isGame3={true}
        round={gameState.round}
        itemsOnBoard={gameState.weldCoverage}
      />
      
      {/* Индикатор прогресса и лимита сварки */}
      <div className="absolute top-20 left-1/2 transform -translate-x-1/2 bg-black/60 backdrop-blur-sm rounded-xl px-6 py-4 text-white z-20 border border-white/20">
        <div className="flex items-center gap-6">
          <div className="text-center">
            <span className="text-xs opacity-80 uppercase tracking-wider block">Заполнение шва</span>
            <span className={`text-2xl font-bold ${gameState.weldCoverage >= 95 ? 'text-green-400' : 'text-white'}`}>
              {gameState.weldCoverage}%
            </span>
          </div>
          <div className="text-center">
            <span className="text-xs opacity-80 uppercase tracking-wider block">Сварка</span>
            <span className={`text-2xl font-bold ${weldPercent >= 90 ? 'text-red-400' : weldPercent >= 70 ? 'text-yellow-400' : 'text-green-400'}`}>
              {weldPercent}%
            </span>
            <span className="text-xs opacity-60 ml-1">({gameState.weldUsed}/{MAX_WELD_POINTS})</span>
          </div>
          <div className="text-center">
            <span className="text-xs opacity-80 uppercase tracking-wider block">Очки</span>
            <span className="text-2xl font-bold text-yellow-400">{gameState.score}</span>
          </div>
        </div>
        
        {/* Прогресс бар заполнения шва */}
        <div className="mt-3 flex gap-4">
          <div className="flex-1">
            <div className="text-xs opacity-60 mb-1">Покрытие шва</div>
            <div className="w-64 h-3 bg-gray-700 rounded-full overflow-hidden">
              <div 
                className={`h-full transition-all duration-300 ${gameState.weldCoverage >= 95 ? 'bg-green-500' : 'bg-gradient-to-r from-orange-500 to-yellow-500'}`}
                style={{ width: `${gameState.weldCoverage}%` }}
              />
            </div>
          </div>
          <div className="flex-1">
            <div className="text-xs opacity-60 mb-1">Использовано сварки</div>
            <div className="w-64 h-3 bg-gray-700 rounded-full overflow-hidden">
              <div 
                className={`h-full transition-all duration-300 ${weldPercent >= 90 ? 'bg-red-500' : weldPercent >= 70 ? 'bg-yellow-500' : 'bg-green-500'}`}
                style={{ width: `${weldPercent}%` }}
              />
            </div>
          </div>
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
      
      {/* Модальное окно победы в раунде */}
      {isRoundComplete && (
        <Modal
          title="Шов заварен!"
          message={`Качество сварки: ${gameState.weldCoverage}%\nОчки за раунд: ${Math.round(1000 * (gameState.weldCoverage / 100))}\nОбщий счет: ${gameState.score}`}
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
      
      {/* Модальное окно проигрыша */}
      {isGameOver && (
        <Modal
          title="Сварка закончилась!"
          message={`Не удалось заполнить шов.\nИспользовано: ${gameState.weldUsed} точек\nПокрытие: ${gameState.weldCoverage}%\nОбщий счет: ${gameState.score}`}
        >
          <div className="space-y-4">
            <Button onClick={handleRestart} variant="primary">
              Попробовать снова
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
          🔥 Зажми ЛКМ и веди вдоль разрыва чтобы заварить шов
        </p>
        <p className="text-sm opacity-80 mt-1">
          Сварка остывает через 2 секунды и становится серой. Можно наваривать на остывшую сварку!
        </p>
      </div>
    </div>
  );
};

export default Game4;
