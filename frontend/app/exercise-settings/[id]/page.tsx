import React from 'react';
import { 
  Box, 
  TextField, 
  Button, 
  Stack, 
  IconButton, 
  Typography, 
  Divider,
  Paper,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle
} from '@mui/material';
import ExerciseSettingsClient from './client';

// Типы для параметров
type PageParams = {
  id: string;
};

// Серверный компонент для обертки клиентского компонента
export default function ExerciseSettingsPage({ params }: { params: PageParams }) {
  return <ExerciseSettingsClient id={params.id} />;
} 