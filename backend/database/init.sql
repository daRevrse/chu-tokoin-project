-- ================================================
-- Script d'initialisation de la base de donnees
-- CHU Tokoin - Systeme de Gestion des Examens
-- ================================================

-- Creer la base de donnees
CREATE DATABASE IF NOT EXISTS chu_tokoin
CHARACTER SET utf8mb4
COLLATE utf8mb4_unicode_ci;

-- Utiliser la base de donnees
USE chu_tokoin;

-- Message de confirmation
SELECT 'Base de donnees chu_tokoin creee avec succes!' AS Message;
