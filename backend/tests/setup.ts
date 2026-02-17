import path from 'path';

// Set test environment variables BEFORE any module imports
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'file:./test.db';
process.env.JWT_SECRET = 'test-secret-key-for-testing';
process.env.UPLOAD_DIR = path.resolve(__dirname, '../../uploads');
process.env.EXPORT_DIR = path.resolve(__dirname, '../../exports');
process.env.FRONTEND_URL = 'http://localhost:5173';
process.env.BASE_URL = 'http://localhost:3001';
