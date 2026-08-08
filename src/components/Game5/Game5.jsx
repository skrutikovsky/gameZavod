import React, { useEffect, useRef, useCallback } from 'react';
import { useGame5, ICE_CREAM_WIDTH, ICE_CREAM_HEIGHT, STICK_WIDTH, STICK_HEIGHT, TUNNEL_WIDTH_PERCENT, CONVEYOR_Y_PERCENT } from '../../hooks/useGame5';
import { GameStats } from '../UI/GameStats';

const Game5 = ({ level, onGameOver, onBack, onLevelComplete }) => {
  const {
    gameState,
    setGameState,
    startGame,
    stopGame,
    resetGame,
    dropStick,
    canvasRef,
    setCanvas
  } = useGame5({ onLevelComplete });

  const requestRef = useRef(null);
  const gameContainerRef = useRef(null);

  useEffect(() => {
    startGame();
    return () => {
      stopGame();
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, []);

  // Отрисовка игры
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    
    // Устанавливаем размер канваса в соответствии с отображаемым размером
    if (canvas.width !== rect.width || canvas.height !== rect.height) {
      canvas.width = rect.width;
      canvas.height = rect.height;
    }

    const width = canvas.width;
    const height = canvas.height;
    const conveyorY = height * CONVEYOR_Y_PERCENT / 100;

    // Очистка
    ctx.clearRect(0, 0, width, height);

    // Фон - темный цех
    const bgGradient = ctx.createLinearGradient(0, 0, 0, height);
    bgGradient.addColorStop(0, '#1a1a2e');
    bgGradient.addColorStop(1, '#16213e');
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, width, height);

    // Рисуем туннели слева и справа
    const tunnelWidth = width * TUNNEL_WIDTH_PERCENT / 100;
    
    // Левый туннель
    const leftTunnelGradient = ctx.createLinearGradient(0, 0, tunnelWidth, 0);
    leftTunnelGradient.addColorStop(0, '#2d3436');
    leftTunnelGradient.addColorStop(0.5, '#636e72');
    leftTunnelGradient.addColorStop(1, '#2d3436');
    ctx.fillStyle = leftTunnelGradient;
    ctx.fillRect(0, 0, tunnelWidth, height);

    // Правый туннель
    const rightTunnelGradient = ctx.createLinearGradient(width - tunnelWidth, 0, width, 0);
    rightTunnelGradient.addColorStop(0, '#2d3436');
    rightTunnelGradient.addColorStop(0.5, '#636e72');
    rightTunnelGradient.addColorStop(1, '#2d3436');
    ctx.fillStyle = rightTunnelGradient;
    ctx.fillRect(width - tunnelWidth, 0, tunnelWidth, height);

    // Конвейерная дорожка (горизонтальная)
    const conveyorHeight = 40;
    const conveyorTop = conveyorY - conveyorHeight / 2;
    
    const conveyorGradient = ctx.createLinearGradient(0, conveyorTop, 0, conveyorTop + conveyorHeight);
    conveyorGradient.addColorStop(0, '#636e72');
    conveyorGradient.addColorStop(0.5, '#b2bec3');
    conveyorGradient.addColorStop(1, '#636e72');
    ctx.fillStyle = conveyorGradient;
    ctx.fillRect(tunnelWidth, conveyorTop, width - tunnelWidth * 2, conveyorHeight);

    // Полоски на конвейере (анимация движения)
    ctx.strokeStyle = '#2d3436';
    ctx.lineWidth = 2;
    const stripeSpacing = 30;
    const offset = (Date.now() / 50) % stripeSpacing;
    for (let x = tunnelWidth - offset; x < width - tunnelWidth; x += stripeSpacing) {
      ctx.beginPath();
      ctx.moveTo(x, conveyorTop);
      ctx.lineTo(x, conveyorTop + conveyorHeight);
      ctx.stroke();
    }

    // Аппарат с палочками по центру сверху
    const dispenserWidth = 120;
    const dispenserHeight = 80;
    const dispenserX = width / 2 - dispenserWidth / 2;
    const dispenserY = 10;

    // Корпус аппарата
    const dispenserGradient = ctx.createLinearGradient(dispenserX, dispenserY, dispenserX + dispenserWidth, dispenserY + dispenserHeight);
    dispenserGradient.addColorStop(0, '#8B4513');
    dispenserGradient.addColorStop(0.5, '#A0522D');
    dispenserGradient.addColorStop(1, '#8B4513');
    ctx.fillStyle = dispenserGradient;
    ctx.fillRect(dispenserX, dispenserY, dispenserWidth, dispenserHeight);

    // Отверстие для палочек
    ctx.fillStyle = '#3d2314';
    ctx.fillRect(width / 2 - 15, dispenserY + dispenserHeight - 10, 30, 10);

    // Декоративные элементы аппарата
    ctx.strokeStyle = '#5c3a21';
    ctx.lineWidth = 3;
    ctx.strokeRect(dispenserX + 5, dispenserY + 5, dispenserWidth - 10, dispenserHeight - 10);

    // Рисуем мороженое
    gameState.iceCreams.forEach(iceCream => {
      const iceX = iceCream.x;
      const iceY = iceCream.y;

      // Тень под мороженым
      ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
      ctx.beginPath();
      ctx.ellipse(iceX + ICE_CREAM_WIDTH / 2, iceY + ICE_CREAM_HEIGHT - 5, ICE_CREAM_WIDTH / 2, 10, 0, 0, Math.PI * 2);
      ctx.fill();

      // Мороженое (без палочки) - форма эскимо
      const iceCreamGradient = ctx.createLinearGradient(iceX, iceY, iceX + ICE_CREAM_WIDTH, iceY + ICE_CREAM_HEIGHT);
      iceCreamGradient.addColorStop(0, '#FFB6C1'); // Светло-розовый
      iceCreamGradient.addColorStop(0.5, '#FF69B4'); // Розовый
      iceCreamGradient.addColorStop(1, '#FF1493'); // Темно-розовый
      
      ctx.fillStyle = iceCreamGradient;
      
      // Рисуем форму мороженого (прямоугольник со скругленным верхом)
      ctx.beginPath();
      ctx.moveTo(iceX + 20, iceY);
      ctx.lineTo(iceX + ICE_CREAM_WIDTH - 20, iceY);
      ctx.quadraticCurveTo(iceX + ICE_CREAM_WIDTH, iceY, iceX + ICE_CREAM_WIDTH, iceY + 40);
      ctx.lineTo(iceX + ICE_CREAM_WIDTH, iceY + ICE_CREAM_HEIGHT - 20);
      ctx.quadraticCurveTo(iceX + ICE_CREAM_WIDTH, iceY + ICE_CREAM_HEIGHT, iceX + ICE_CREAM_WIDTH - 20, iceY + ICE_CREAM_HEIGHT);
      ctx.lineTo(iceX + 20, iceY + ICE_CREAM_HEIGHT);
      ctx.quadraticCurveTo(iceX, iceY + ICE_CREAM_HEIGHT, iceX, iceY + ICE_CREAM_HEIGHT - 20);
      ctx.lineTo(iceX, iceY + 40);
      ctx.quadraticCurveTo(iceX, iceY, iceX + 20, iceY);
      ctx.closePath();
      ctx.fill();

      // Блик на мороженом
      ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.beginPath();
      ctx.ellipse(iceX + ICE_CREAM_WIDTH * 0.3, iceY + ICE_CREAM_HEIGHT * 0.3, 15, 30, -0.2, 0, Math.PI * 2);
      ctx.fill();

      // Если есть палочка - рисуем её внутри мороженого
      if (iceCream.hasStick) {
        const stickX = iceCream.stickX;
        const stickBottomY = iceY + ICE_CREAM_HEIGHT;
        
        // Палочка
        const stickGradient = ctx.createLinearGradient(stickX, stickBottomY - STICK_HEIGHT, stickX + STICK_WIDTH, stickBottomY);
        stickGradient.addColorStop(0, '#DEB887');
        stickGradient.addColorStop(1, '#8B7355');
        ctx.fillStyle = stickGradient;
        ctx.fillRect(stickX, stickBottomY - STICK_HEIGHT, STICK_WIDTH, STICK_HEIGHT);
        
        // Текстура палочки
        ctx.strokeStyle = '#654321';
        ctx.lineWidth = 1;
        for (let i = 0; i < STICK_HEIGHT; i += 10) {
          ctx.beginPath();
          ctx.moveTo(stickX, stickBottomY - STICK_HEIGHT + i);
          ctx.lineTo(stickX + STICK_WIDTH, stickBottomY - STICK_HEIGHT + i);
          ctx.stroke();
        }
      }
    });

    // Рисуем падающие палочки
    gameState.sticks.forEach(stick => {
      const stickX = stick.x;
      const stickY = stick.y;

      // Палочка
      const stickGradient = ctx.createLinearGradient(stickX, stickY, stickX + STICK_WIDTH, stickY + STICK_HEIGHT);
      stickGradient.addColorStop(0, '#DEB887');
      stickGradient.addColorStop(1, '#8B7355');
      ctx.fillStyle = stickGradient;
      ctx.fillRect(stickX, stickY, STICK_WIDTH, STICK_HEIGHT);

      // Текстура палочки
      ctx.strokeStyle = '#654321';
      ctx.lineWidth = 1;
      for (let i = 0; i < STICK_HEIGHT; i += 10) {
        ctx.beginPath();
        ctx.moveTo(stickX, stickY + i);
        ctx.lineTo(stickX + STICK_WIDTH, stickY + i);
        ctx.stroke();
      }
    });

    // Зоны попадания (отладочная визуализация - можно убрать)
    // Центральная зона 20% (500 очков)
    // Средние зоны 70% (300 очков)
    // Крайние зоны 15% (промах)

    requestRef.current = requestAnimationFrame(draw);
  }, [gameState.iceCreams, gameState.sticks]);

  // Запуск цикла отрисовки
  useEffect(() => {
    requestRef.current = requestAnimationFrame(draw);
    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, [draw]);

  const handleRestart = () => {
    resetGame();
    startGame();
  };

  const handleGameOver = () => {
    onGameOver();
  };

  return (
    <div 
      ref={gameContainerRef}
      className="game-container relative w-full h-screen overflow-hidden"
      tabIndex={0}
    >
      {/* Статистика игры */}
      <GameStats
        score={gameState.score}
        lives={3}
        multiplier={1}
        boxesFixed={0}
        comboCount={0}
        gameTime={0}
        formatTime={() => ''}
        onBack={onBack}
        isGame3={true}
        isGame4={false}
      />

      {/* Канвас для отрисовки игры */}
      <canvas
        ref={(ref) => {
          setCanvas(ref);
          canvasRef.current = ref;
        }}
        className="absolute top-0 left-0 w-full h-full"
      />

      {/* Инструкция */}
      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-black/60 text-white px-6 py-3 rounded-lg backdrop-blur-sm">
        <p className="text-center text-lg">Нажми <span className="font-bold text-yellow-400">ПРОБЕЛ</span> чтобы уронить палочку</p>
        <p className="text-center text-sm opacity-80 mt-1">
          Центр 20% = 500 очков | 70% = 300 очков | Края = промах
        </p>
      </div>

      {/* Модальное окно конца игры (если нужно) */}
      {!gameState.isRunning && gameState.score > 0 && (
        <div className="absolute inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-gray-800 p-8 rounded-lg shadow-xl max-w-md">
            <h2 className="text-3xl font-bold text-white mb-4 text-center">Игра окончена!</h2>
            <p className="text-2xl text-yellow-400 mb-6 text-center">Счёт: {gameState.score}</p>
            <div className="flex gap-4 justify-center">
              <button
                onClick={handleRestart}
                className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold transition-all"
              >
                Рестарт
              </button>
              <button
                onClick={handleGameOver}
                className="px-6 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-bold transition-all"
              >
                В меню
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Game5;
