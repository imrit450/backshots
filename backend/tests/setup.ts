import path from 'path';

// Set test environment variables BEFORE any module imports
process.env.NODE_ENV = 'test';
// Don't overwrite DATABASE_URL if already set (e.g. by CI with postgresql://)
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'postgresql://backshots:backshots_dev@localhost:5432/backshots?schema=public';
}
process.env.JWT_SECRET = 'test-secret-key-for-testing';
process.env.UPLOAD_DIR = path.resolve(__dirname, '../../uploads');
process.env.EXPORT_DIR = path.resolve(__dirname, '../../exports');
process.env.FRONTEND_URL = 'http://localhost:5173';
process.env.BASE_URL = 'http://localhost:3001';
