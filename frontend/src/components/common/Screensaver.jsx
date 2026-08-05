import React, { useState, useEffect, useCallback } from 'react';
import { Box, Fade } from '@mui/material';
import Lottie from 'lottie-react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import animationData from '../../assets/screensaver-animation.json';

const Screensaver = ({ timeout = 60000 }) => {
  const [isIdle, setIsIdle] = useState(false);
  const location = useLocation();
  const { user } = useAuth(); // Permet de savoir si l'utilisateur est connecté

  const handleActivity = useCallback(() => {
    if (isIdle) {
      setIsIdle(false);
    }
  }, [isIdle]);

  useEffect(() => {
    // Ne pas activer le screensaver sur la page de login ou si non connecté
    if (location.pathname === '/login' || !user) {
      setIsIdle(false);
      return;
    }

    let idleTimer;

    const resetTimer = () => {
      handleActivity();
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => setIsIdle(true), timeout);
    };

    resetTimer();

    window.addEventListener('mousemove', resetTimer);
    window.addEventListener('mousedown', resetTimer);
    window.addEventListener('keydown', resetTimer);
    window.addEventListener('touchstart', resetTimer);
    window.addEventListener('scroll', resetTimer);

    return () => {
      clearTimeout(idleTimer);
      window.removeEventListener('mousemove', resetTimer);
      window.removeEventListener('mousedown', resetTimer);
      window.removeEventListener('keydown', resetTimer);
      window.removeEventListener('touchstart', resetTimer);
      window.removeEventListener('scroll', resetTimer);
    };
  }, [handleActivity, timeout, location.pathname, user]);

  return (
    // unmountOnExit gère la présence dans le DOM sans casser l'animation MUI
    <Fade in={isIdle} timeout={800} mountOnEnter unmountOnExit>
      <Box
        sx={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          backgroundColor: '#f5f5f5',
          zIndex: 9999,
          display: 'flex', // On garde toujours flex, le Fade s'occupe de le masquer
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'none'
        }}
      >
        <Box sx={{ width: { xs: 300, md: 500 }, height: { xs: 300, md: 500 } }}>
          <Lottie 
            animationData={animationData} 
            loop={true} 
            autoplay={true}
          />
        </Box>
      </Box>
    </Fade>
  );
};

export default Screensaver;