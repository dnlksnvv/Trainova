import React, { useEffect, useState } from 'react';
import { Button, Snackbar, Alert, AlertTitle } from '@mui/material';
import GetAppIcon from '@mui/icons-material/GetApp';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const InstallPWA: React.FC = () => {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallOption, setShowInstallOption] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
      setShowInstallOption(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!installPrompt) {
      return;
    }

    await installPrompt.prompt();
    
    const choiceResult = await installPrompt.userChoice;
    if (choiceResult.outcome === 'accepted') {
      console.log('Пользователь установил приложение');
    } else {
      console.log('Пользователь отклонил установку');
    }

    setInstallPrompt(null);
    setShowInstallOption(false);
  };

  const handleClose = () => {
    setShowInstallOption(false);
  };

  if (!showInstallOption) return null;

  return (
    <Snackbar
      open={showInstallOption}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      autoHideDuration={15000}
      onClose={handleClose}
    >
      <Alert 
        severity="info" 
        sx={{ width: '100%' }}
        action={
          <Button 
            color="inherit" 
            startIcon={<GetAppIcon />}
            onClick={handleInstallClick}
            size="small"
          >
            Установить
          </Button>
        }
      >
        <AlertTitle>Установите приложение Trainova</AlertTitle>
        Установите приложение на ваше устройство для быстрого доступа и работы офлайн
      </Alert>
    </Snackbar>
  );
};

export default InstallPWA; 