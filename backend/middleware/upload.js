const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');

// Creer le dossier uploads s'il n'existe pas
const uploadDir = process.env.UPLOAD_PATH || './uploads';
const resultsDir = path.join(uploadDir, 'results');

if (!fs.existsSync(resultsDir)) {
  fs.mkdirSync(resultsDir, { recursive: true });
}

// Configuration du stockage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Organiser par date
    const date = new Date();
    const yearMonth = `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}`;
    const destDir = path.join(resultsDir, yearMonth);

    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }

    cb(null, destDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${crypto.randomUUID()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

// Filtre des types de fichiers
const fileFilter = (req, file, cb) => {
  const allowedMimes = [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/gif',
    'application/dicom'
  ];

  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Type de fichier non autorise. Formats acceptes: PDF, JPEG, PNG, GIF, DICOM'), false);
  }
};

// Configuration multer
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024 // 10MB par defaut
  }
});

// Determiner le type de fichier
const getFileType = (mimeType) => {
  if (mimeType === 'application/pdf') return 'PDF';
  if (mimeType.startsWith('image/')) return 'IMAGE';
  if (mimeType === 'application/dicom') return 'DICOM';
  return 'PDF';
};

module.exports = {
  upload,
  getFileType,
  resultsDir
};
