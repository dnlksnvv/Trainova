"use client";

import React, { useState, useEffect, useRef } from "react";
import { useTheme } from "@mui/material/styles";
import { 
  Stack, 
  Box, 
  InputBase, 
  IconButton,
  Typography,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import CloseIcon from "@mui/icons-material/Close";
import FilterListIcon from '@mui/icons-material/FilterList';
import PersonIcon from '@mui/icons-material/Person';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AddIcon from '@mui/icons-material/Add';
import SettingsIcon from '@mui/icons-material/Settings';
import ProfileAvatarButton from './ProfileAvatarButton';

interface SearchBarProps {
  isSearchBarVisible: boolean;
  isAtTop: boolean;
  onCoachProfileClick?: () => void;
  onBackClick?: () => void;
  onCreateClick?: () => void;
  onSettingsClick?: () => void;
  onFilterClick?: () => void;
  showBackButton?: boolean;
  showProfileButton?: boolean;
  showCreateButton?: boolean;
  showFilterButton?: boolean;
  showSettingsButton?: boolean;
  showSearchField?: boolean;
  title?: string;
  placeholder?: string;
  onSearchChange?: (value: string) => void;
  searchValue?: string;
}

const SearchBar: React.FC<SearchBarProps> = ({ 
  isSearchBarVisible, 
  isAtTop, 
  onCoachProfileClick,
  onBackClick,
  onCreateClick,
  onSettingsClick,
  onFilterClick,
  showBackButton = false,
  showProfileButton = true,
  showCreateButton = false,
  showFilterButton = true,
  showSettingsButton = false,
  showSearchField = true,
  title,
  placeholder = "Поиск курсов",
  onSearchChange,
  searchValue = ""
}) => {
  const theme = useTheme();
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchBoxRef = useRef<HTMLDivElement>(null);

  // Обработчик для закрытия поиска при клике вне поля
  useEffect(() => {
    const handleClickOutside = (event: Event) => {
      if (
        isSearchFocused && 
        searchBoxRef.current && 
        !searchBoxRef.current.contains(event.target as Node)
      ) {
        // Только убираем фокус, НЕ очищаем поле поиска
        setIsSearchFocused(false);
        
        // Убираем фокус с поля ввода
        if (searchInputRef.current && document.activeElement === searchInputRef.current) {
          searchInputRef.current.blur();
        }
        
        // НЕ вызываем onSearchChange('') - это и была причина сброса результатов поиска
      }
    };

    // Добавляем обработчик клика
    if (isSearchFocused) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }

    // Очистка при размонтировании
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isSearchFocused]);

  // Функция для фокуса на поле поиска
  const handleSearchClick = () => {
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  };

  // Функция для очистки поиска
  const handleClearSearch = () => {
    console.log('Очищаем поле поиска');
    // Убираем прямое изменение value через ref - у нас controlled input
    // if (searchInputRef.current) {
    //   searchInputRef.current.value = '';
    // }
    
    setIsSearchFocused(false);
    
    // Вызываем обработчик изменения с пустой строкой для сброса поиска
    if (onSearchChange) {
      console.log('Вызываем onSearchChange с пустой строкой');
      onSearchChange('');
    }
  };

  // Функция для безопасного закрытия поиска
  const safeCloseSearch = () => {
    console.log('safeCloseSearch вызван');
    // Предотвращаем смещение элементов при закрытии поиска
    if (searchInputRef.current) {
      searchInputRef.current.blur();
    }
    
    // Небольшая задержка перед сбросом фокуса для предотвращения визуальных артефактов
    setTimeout(() => {
      setIsSearchFocused(false);
    }, 50);
  };

  // Обработчик изменения поискового запроса
  const handleSearchInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    console.log('handleSearchInputChange:', e.target.value);
    if (onSearchChange) {
      onSearchChange(e.target.value);
    }
  };

  // Специальный режим для страницы тренировки (если есть заголовок, но нет поля поиска)
  const isWorkoutMode = !showSearchField && title;

  return (
    <>
      {/* Затемненный оверлей, появляющийся при фокусе на поиск - убираем */}
      {/* {isSearchFocused && (
        <Box
          onClick={(e) => {
            e.stopPropagation();
            safeCloseSearch();
          }}
          sx={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            zIndex: 1200,
          }}
        />
      )} */}
      
      <Box
        sx={{
          position: 'fixed',
          top: 10,
          left: '50%',
          transform: isSearchBarVisible 
            ? 'translateX(-50%)' 
            : 'translate(-50%, -150%)',
          width: '94%', 
          maxWidth: '1200px',
          zIndex: 1300,
          borderRadius: 10,
          backgroundColor: theme.palette.backgrounds?.default,
          boxShadow: theme.palette.mode === 'dark'
            ? `0 4px 20px rgba(0,0,0,${isSearchBarVisible && !isAtTop ? '0.3' : '0'}), 
               0 0 8px rgba(255,255,255,${isSearchBarVisible && !isAtTop ? '0.06' : '0'})`
            : `0 4px 16px rgba(0,0,0,${isSearchBarVisible && !isAtTop ? '0.15' : '0'}), 
               0 0 4px rgba(0,0,0,${isSearchBarVisible && !isAtTop ? '0.05' : '0'})`,
          transition: 'transform 0.3s cubic-bezier(0.33, 1, 0.68, 1), box-shadow 0.3s ease-out',
          pointerEvents: isSearchBarVisible ? 'auto' : 'none',
        }}
        className="search-bar-component"
      >
        <Stack 
          direction="column"
          justifyContent="space-between" 
          alignItems="stretch"
          spacing={1.5}
          sx={{ 
            width: '100%',
            py: 1,
            px: 1,
          }}
        >
          {/* Особая структура для режима тренировки с заголовком и без поля поиска */}
          {isWorkoutMode ? (
            <Stack 
              direction="row" 
              justifyContent="space-between"
              alignItems="center"
              sx={{ width: '100%' }}
            >
              {/* Левая часть с кнопкой назад */}
              {showBackButton && (
                <IconButton 
                  onClick={onBackClick}
                  sx={{ 
                    color: theme.palette.textColors?.primary,
                    backgroundColor: 'rgba(0, 0, 0, 0.2)',
                    borderRadius: '50%',
                    '&:hover': {
                      backgroundColor: 'rgba(0, 0, 0, 0.3)',
                    },
                    width: 40,
                    height: 40
                  }}
                >
                  <ArrowBackIcon />
                </IconButton>
              )}
              
              {/* Центральная часть с заголовком */}
              <Typography 
                variant="h6" 
                fontWeight="bold"
                sx={{ 
                  color: theme.palette.textColors?.primary,
                  fontSize: { xs: '1.1rem', sm: '1.25rem' },
                  fontFamily: theme.typography.fontFamily,
                  textAlign: 'center',
                  flex: 1,
                  mx: 2,
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  width: '70%',
                  margin: '0 auto'
                }}
              >
                {title}
              </Typography>
              
              {/* Правая часть с кнопками (настройки и другие) */}
              <Box sx={{ display: 'flex', gap: 1.5, ml: 'auto' }}>
                {showFilterButton && (
                  <IconButton 
                    sx={{ 
                      color: theme.palette.textColors?.primary,
                      backgroundColor: 'rgba(0, 0, 0, 0.2)',
                      borderRadius: '50%',
                      '&:hover': {
                        backgroundColor: 'rgba(0, 0, 0, 0.3)',
                      },
                      width: 40,
                      height: 40
                    }}
                  >
                    <FilterListIcon />
                  </IconButton>
                )}
                
                {showSettingsButton && (
                  <IconButton 
                    onClick={onSettingsClick}
                    sx={{ 
                      color: theme.palette.textColors?.primary,
                      backgroundColor: 'rgba(0, 0, 0, 0.2)',
                      borderRadius: '50%',
                      '&:hover': {
                        backgroundColor: 'rgba(0, 0, 0, 0.3)',
                      },
                      width: 40,
                      height: 40
                    }}
                  >
                    <SettingsIcon />
                  </IconButton>
                )}
                
                {showCreateButton && (
                  <IconButton
                    onClick={onCreateClick}
                    sx={{
                      backgroundColor: theme.palette.highlight?.main,
                      color: theme.palette.textColors?.primary,
                      borderRadius: '50%',
                      '&:hover': {
                        backgroundColor: theme.palette.highlight?.accent,
                      },
                      width: 40,
                      height: 40
                    }}
                  >
                    <AddIcon />
                  </IconButton>
                )}
                
                {showProfileButton && (
                  <ProfileAvatarButton
                    onClick={onCoachProfileClick}
                  />
                )}
              </Box>
            </Stack>
          ) : (
            /* Стандартная структура для обычных страниц */
            <Stack 
              direction="row" 
              spacing={isSearchFocused && showSearchField ? 0 : 1.5}
              alignItems="center"
              sx={{ 
                width: '100%', 
                position: 'relative',
                transition: 'gap 0.25s ease-in-out'
              }}
            >
              {/* Кнопка назад (если включена) */}
              {showBackButton && (
                <Box sx={{ 
                  width: isSearchFocused && showSearchField ? '0px' : '40px',
                  overflow: 'hidden',
                  transition: 'width 0.25s ease-in-out',
                  flexShrink: 0
                }}>
                  <IconButton 
                    onClick={onBackClick}
                    sx={{ 
                      color: theme.palette.textColors?.primary,
                      backgroundColor: 'rgba(0, 0, 0, 0.2)',
                      borderRadius: '50%',
                      '&:hover': {
                        backgroundColor: 'rgba(0, 0, 0, 0.3)',
                      },
                      width: 40,
                      height: 40,
                      zIndex: 1,
                      opacity: isSearchFocused && showSearchField ? 0 : 1,
                      transform: isSearchFocused && showSearchField ? 'scale(0.8)' : 'scale(1)',
                      transition: 'all 0.25s ease-in-out',
                      pointerEvents: isSearchFocused && showSearchField ? 'none' : 'auto',
                    }}
                  >
                    <ArrowBackIcon />
                  </IconButton>
                </Box>
              )}
              
              {/* Поле поиска (только если showSearchField = true) */}
              {showSearchField && (
                <Box
                  ref={searchBoxRef}
                  onClick={handleSearchClick}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    borderRadius: 25,
                    backgroundColor: isSearchFocused 
                      ? 'rgba(0, 0, 0, 0.3)'
                      : 'rgba(0, 0, 0, 0.2)',
                    paddingLeft: 2,
                    paddingRight: 1,
                    flex: 1,
                    maxWidth: '100%',
                    transform: isSearchFocused ? 'scale(1.01)' : 'scale(1)',
                    boxShadow: isSearchFocused ? '0 4px 20px rgba(0,0,0,0.3)' : 'none',
                    transition: 'all 0.25s ease-in-out',
                    zIndex: isSearchFocused ? 10 : 1,
                  }}
                >
                  <InputBase
                    placeholder={placeholder}
                    onFocus={() => setIsSearchFocused(true)}
                    onBlur={(e) => {
                      console.log('InputBase onBlur срабатывает');
                      // Предотвращаем немедленный сброс фокуса для избежания визуальных артефактов
                      if (!searchBoxRef.current?.contains(e.relatedTarget as Node)) {
                        console.log('onBlur: вызываем safeCloseSearch');
                        // Используем безопасное закрытие
                        safeCloseSearch();
                      } else {
                        console.log('onBlur: не вызываем safeCloseSearch, клик внутри searchBox');
                      }
                    }}
                    inputRef={searchInputRef}
                    value={searchValue}
                    onChange={handleSearchInputChange}
                    sx={{
                      flex: 1,
                      color: theme.palette.textColors?.secondary,
                      fontSize: '0.9rem',
                      py: 0.5,
                      '& input': {
                        fontSize: '16px',
                        '-webkit-text-size-adjust': '100%',
                        '-webkit-font-smoothing': 'antialiased',
                        '-webkit-tap-highlight-color': 'transparent',
                        touchAction: 'manipulation',
                      }
                    }}
                    inputProps={{
                      autoComplete: 'off',
                      autoCorrect: 'off',
                      autoCapitalize: 'off',
                      spellCheck: 'false',
                    }}
                  />
                  <IconButton 
                    onClick={isSearchFocused ? handleClearSearch : handleSearchClick}
                    sx={{ 
                      color: theme.palette.textColors?.secondary,
                      opacity: isSearchFocused ? 0.8 : 0.6,
                      transition: 'opacity 0.25s ease-in-out',
                    }}
                  >
                    {isSearchFocused ? <CloseIcon /> : <SearchIcon />}
                  </IconButton>
                </Box>
              )}

              {/* Кнопки расположены в одном ряду с полем поиска */}
              <Box 
                sx={{ 
                  display: 'flex',
                  flexDirection: 'row',
                  gap: 1.5,
                  width: isSearchFocused && showSearchField ? '0px' : 'auto',
                  overflow: 'hidden',
                  opacity: isSearchFocused && showSearchField ? 0 : 1,
                  transform: isSearchFocused && showSearchField ? 'translateX(10px)' : 'translateX(0)',
                  transition: 'all 0.25s ease-in-out',
                  pointerEvents: isSearchFocused && showSearchField ? 'none' : 'auto',
                  ml: 'auto'
                }}
              >
                {/* Кнопка фильтра */}
                {showFilterButton && (
                  <IconButton 
                    onClick={onFilterClick}
                    sx={{ 
                      color: theme.palette.textColors?.primary,
                      backgroundColor: 'rgba(0, 0, 0, 0.2)',
                      borderRadius: '50%',
                      '&:hover': {
                        backgroundColor: 'rgba(0, 0, 0, 0.3)',
                      },
                      width: 40,
                      height: 40
                    }}
                  >
                    <FilterListIcon />
                  </IconButton>
                )}

                {/* Кнопка настроек */}
                {showSettingsButton && (
                  <IconButton 
                    onClick={onSettingsClick}
                    sx={{ 
                      color: theme.palette.textColors?.primary,
                      backgroundColor: 'rgba(0, 0, 0, 0.2)',
                      borderRadius: '50%',
                      '&:hover': {
                        backgroundColor: 'rgba(0, 0, 0, 0.3)',
                      },
                      width: 40,
                      height: 40
                    }}
                  >
                    <SettingsIcon />
                  </IconButton>
                )}

                {/* Кнопка создания нового курса */}
                {showCreateButton && (
                  <IconButton
                    onClick={onCreateClick}
                    sx={{
                      backgroundColor: theme.palette.highlight?.main,
                      color: theme.palette.textColors?.primary,
                      borderRadius: '50%',
                      '&:hover': {
                        backgroundColor: theme.palette.highlight?.accent,
                      },
                      width: 40,
                      height: 40
                    }}
                  >
                    <AddIcon />
                  </IconButton>
                )}

                {/* Кнопка профиля тренера (если включена) */}
                {showProfileButton && (
                  <ProfileAvatarButton
                    onClick={onCoachProfileClick}
                  />
                )}
              </Box>
            </Stack>
          )}
        </Stack>
      </Box>
    </>
  );
};

export default SearchBar;
