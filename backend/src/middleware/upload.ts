import { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';

// Ensure upload directories exist
const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';
const PHOTOS_DIR = path.join(UPLOAD_DIR, 'photos');
const THUMBNAILS_DIR = path.join(UPLOAD_DIR, 'thumbnails');

[UPLOAD_DIR, PHOTOS_DIR, THUMBNAILS_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Configure multer storage
const storage = multer.memoryStorage();

// File filter for images
const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPEG, PNG, and WebP are allowed.'));
  }
};

// Multer upload configuration
export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max file size
    files: 5 // Max 5 files per upload
  }
});

// Image optimization settings
const OPTIMIZATION_CONFIG = {
  maxWidth: 1920,
  maxHeight: 1920,
  quality: 80,
  thumbnailWidth: 300,
  thumbnailHeight: 300,
  thumbnailQuality: 60
};

/**
 * Optimize and save image with thumbnail
 */
export const optimizeImage = async (
  buffer: Buffer,
  filename: string,
  companyId?: string
): Promise<{ imageUrl: string; thumbnailUrl: string; fileSize: number; mimeType: string }> => {
  // Create company-specific subdirectory if companyId provided
  const companyDir = companyId ? path.join(PHOTOS_DIR, companyId) : PHOTOS_DIR;
  const companyThumbDir = companyId ? path.join(THUMBNAILS_DIR, companyId) : THUMBNAILS_DIR;
  
  [companyDir, companyThumbDir].forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });

  const uniqueName = `${uuidv4()}-${filename}`;
  const imagePath = path.join(companyDir, uniqueName);
  const thumbnailPath = path.join(companyThumbDir, `thumb-${uniqueName}`);

  // Process main image
  const processedImage = await sharp(buffer)
    .resize(OPTIMIZATION_CONFIG.maxWidth, OPTIMIZATION_CONFIG.maxHeight, {
      fit: 'inside',
      withoutEnlargement: true
    })
    .jpeg({ quality: OPTIMIZATION_CONFIG.quality, progressive: true })
    .toBuffer();

  // Save main image
  await fs.promises.writeFile(imagePath, processedImage);

  // Create thumbnail
  const thumbnailBuffer = await sharp(buffer)
    .resize(OPTIMIZATION_CONFIG.thumbnailWidth, OPTIMIZATION_CONFIG.thumbnailHeight, {
      fit: 'cover',
      position: 'centre'
    })
    .jpeg({ quality: OPTIMIZATION_CONFIG.thumbnailQuality })
    .toBuffer();

  // Save thumbnail
  await fs.promises.writeFile(thumbnailPath, thumbnailBuffer);

  // Generate URLs (relative paths)
  const baseUrl = process.env.UPLOAD_BASE_URL || '/uploads';
  const companyPath = companyId ? `/${companyId}` : '';
  
  return {
    imageUrl: `${baseUrl}/photos${companyPath}/${uniqueName}`,
    thumbnailUrl: `${baseUrl}/thumbnails${companyPath}/thumb-${uniqueName}`,
    fileSize: processedImage.length,
    mimeType: 'image/jpeg'
  };
};

/**
 * Delete image and thumbnail
 */
export const deleteImage = async (imageUrl: string): Promise<void> => {
  try {
    const basePath = process.env.UPLOAD_BASE_URL || '/uploads';
    const relativePath = imageUrl.replace(basePath, '');
    const fullPath = path.join(UPLOAD_DIR, relativePath);
    const thumbnailPath = fullPath.replace('/photos/', '/thumbnails/').replace(/([^/]+)$/, 'thumb-$1');

    // Delete main image
    if (fs.existsSync(fullPath)) {
      await fs.promises.unlink(fullPath);
    }

    // Delete thumbnail
    if (fs.existsSync(thumbnailPath)) {
      await fs.promises.unlink(thumbnailPath);
    }
  } catch (error) {
    console.error('Error deleting image:', error);
  }
};

/**
 * Middleware to handle upload errors
 */
export const handleUploadError = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large. Maximum size is 10MB.' });
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({ error: 'Too many files. Maximum is 5 files per upload.' });
    }
    return res.status(400).json({ error: err.message });
  }
  
  if (err) {
    return res.status(400).json({ error: err.message });
  }
  
  next();
};

/**
 * Validate company access for uploaded files
 */
export const validateCompanyAccess = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const user = (req as any).user;
  const companyId = req.params.companyId || req.body.companyId;
  
  // Admin can access any company
  if (user?.role === 'admin') {
    return next();
  }
  
  // Check if user belongs to the requested company
  if (companyId && user?.companyId && companyId !== user.companyId) {
    return res.status(403).json({ error: 'Access denied for this company' });
  }
  
  next();
};
