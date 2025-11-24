import multer from 'multer';
import * as path from 'path';
import * as fs from 'fs';

// Ensure uploads directory exists
const uploads_dir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploads_dir)) {
  fs.mkdirSync(uploads_dir, { recursive: true });
}

// Configure multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploads_dir);
  },
  filename: (req, file, cb) => {
    const unique_suffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname);
    cb(null, `order-${unique_suffix}${ext}`);
  },
});

// File filter - allow zip files and image files (for individual orders with passport)
const file_filter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const allowed_extensions = ['.zip', '.jpg', '.jpeg', '.png', '.pdf'];
  const allowed_mime_types = [
    'application/zip',
    'application/x-zip-compressed',
    'image/jpeg',
    'image/jpg',
    'image/png',
    'application/pdf',
  ];

  if (allowed_mime_types.includes(file.mimetype) || allowed_extensions.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error(`File type not allowed. Allowed types: ${allowed_extensions.join(', ')}`));
  }
};

// Configure multer
export const upload = multer({
  storage: storage,
  fileFilter: file_filter,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB max file size
  },
});

// Helper to get file URL
export const get_file_url = (filename: string): string => {
  return `/uploads/${filename}`;
};

// Helper to get file path
export const get_file_path = (filename: string): string => {
  return path.join(uploads_dir, filename);
};

// Helper to delete file
export const delete_file = async (file_path: string): Promise<void> => {
  try {
    if (fs.existsSync(file_path)) {
      fs.unlinkSync(file_path);
    }
  } catch (error) {
    // Ignore errors when deleting temp files
  }
};


