import mongoose from 'mongoose';
import { beforeAll, afterAll, beforeEach } from 'vitest';
import { connectDB, disconnectDB } from '../src/db.js';

// Strictly use isolated test database
const TEST_MONGODB_URI = 'mongodb://127.0.0.1:27017/envbook_test';

beforeAll(async () => {
  await connectDB(TEST_MONGODB_URI);
});

afterAll(async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.dropDatabase();
    await disconnectDB();
  }
});

beforeEach(async () => {
  if (mongoose.connection.readyState === 1) {
    const collections = mongoose.connection.collections;
    for (const key in collections) {
      await collections[key].deleteMany({});
    }
  }
});
