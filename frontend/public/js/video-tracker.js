// Скрипт для отслеживания времени воспроизведения видео в iframe
// и отправки этих данных в родительское окно через postMessage

(function() {
  // Проверяем, находимся ли мы в iframe
  if (window.self !== window.top) {
    let currentPlayer = null;
    let updateInterval = null;
    const UPDATE_INTERVAL_MS = 1000; // Обновляем каждую секунду
    
    // Функция для определения типа плеера (YouTube, Vimeo и др.)
    function detectPlayerType() {
      if (typeof YT !== 'undefined' && YT.Player) {
        return 'youtube';
      } else if (typeof Vimeo !== 'undefined') {
        return 'vimeo';
      } else if (document.querySelector('video')) {
        return 'html5';
      }
      return null;
    }
    
    // Функция для инициализации соответствующего плеера
    function initPlayer() {
      const playerType = detectPlayerType();
      
      if (playerType === 'youtube') {
        initYouTubePlayer();
      } else if (playerType === 'vimeo') {
        initVimeoPlayer();
      } else if (playerType === 'html5') {
        initHTML5Player();
      }
    }
    
    // Инициализация YouTube плеера
    function initYouTubePlayer() {
      // Находим iframe с YouTube видео
      const ytIframe = document.querySelector('iframe[src*="youtube.com"]');
      if (!ytIframe) return;
      
      // Если API YouTube загружено
      if (typeof YT !== 'undefined' && YT.Player) {
        currentPlayer = new YT.Player(ytIframe, {
          events: {
            'onStateChange': onYouTubeStateChange
          }
        });
      } else {
        // Если API еще не загружено, добавляем слушатель событий
        window.onYouTubeIframeAPIReady = function() {
          currentPlayer = new YT.Player(ytIframe, {
            events: {
              'onStateChange': onYouTubeStateChange
            }
          });
        };
        
        // Загружаем API YouTube
        const tag = document.createElement('script');
        tag.src = "https://www.youtube.com/iframe_api";
        const firstScriptTag = document.getElementsByTagName('script')[0];
        firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
      }
    }
    
    // Обработчик событий для YouTube плеера
    function onYouTubeStateChange(event) {
      if (event.data === YT.PlayerState.PLAYING) {
        startTracking();
      } else if (event.data === YT.PlayerState.PAUSED || event.data === YT.PlayerState.ENDED) {
        stopTracking();
        // Отправляем последнее известное время
        sendCurrentTime();
      }
    }
    
    // Инициализация Vimeo плеера
    function initVimeoPlayer() {
      const vimeoIframe = document.querySelector('iframe[src*="vimeo.com"]');
      if (!vimeoIframe) return;
      
      if (typeof Vimeo !== 'undefined') {
        currentPlayer = new Vimeo.Player(vimeoIframe);
        
        currentPlayer.on('play', function() {
          startTracking();
        });
        
        currentPlayer.on('pause', function() {
          stopTracking();
          sendCurrentTime();
        });
        
        currentPlayer.on('ended', function() {
          stopTracking();
          sendCurrentTime();
        });
      }
    }
    
    // Инициализация HTML5 плеера
    function initHTML5Player() {
      const videoElement = document.querySelector('video');
      if (!videoElement) return;
      
      currentPlayer = videoElement;
      
      videoElement.addEventListener('play', function() {
        startTracking();
      });
      
      videoElement.addEventListener('pause', function() {
        stopTracking();
        sendCurrentTime();
      });
      
      videoElement.addEventListener('ended', function() {
        stopTracking();
        sendCurrentTime();
      });
    }
    
    // Начать отслеживание времени воспроизведения
    function startTracking() {
      if (updateInterval) clearInterval(updateInterval);
      
      updateInterval = setInterval(function() {
        sendCurrentTime();
      }, UPDATE_INTERVAL_MS);
    }
    
    // Остановить отслеживание времени воспроизведения
    function stopTracking() {
      if (updateInterval) {
        clearInterval(updateInterval);
        updateInterval = null;
      }
    }
    
    // Получить текущее время воспроизведения
    function getCurrentTime() {
      try {
        if (!currentPlayer) return 0;
        
        // YouTube
        if (currentPlayer.getCurrentTime && typeof currentPlayer.getCurrentTime === 'function') {
          return currentPlayer.getCurrentTime();
        }
        // Vimeo
        else if (currentPlayer.getCurrentTime && typeof currentPlayer.getCurrentTime === 'function') {
          return currentPlayer.getCurrentTime();
        }
        // HTML5 Video
        else if (currentPlayer.currentTime !== undefined) {
          return currentPlayer.currentTime;
        }
      } catch (e) {
        console.error('Ошибка при получении текущего времени:', e);
      }
      
      return 0;
    }
    
    // Отправить текущее время в родительское окно
    function sendCurrentTime() {
      const currentTime = getCurrentTime();
      
      // Отправляем сообщение родительскому окну
      window.parent.postMessage({
        videoTime: currentTime
      }, '*');
    }
    
    // Инициализируем плеер при загрузке страницы
    window.addEventListener('load', initPlayer);
    
    // Также пытаемся инициализировать через небольшой промежуток времени,
    // на случай если API загружается асинхронно
    setTimeout(initPlayer, 1000);
  }
})(); 