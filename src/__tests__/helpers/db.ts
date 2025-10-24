import {MongoMemoryServer} from 'mongodb-memory-server';
import mongoose from 'mongoose';

let mongoServer: MongoMemoryServer | null = null;

/**
 * Connect to the in-memory database
 */
export const connectTestDB = async (): Promise<void> => {
    // Close any existing connections
    if (mongoose.connection.readyState !== 0) {
        await mongoose.disconnect();
    }

    // Create a new in-memory database
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();

    await mongoose.connect(mongoUri);
};

/**
 * Drop database, close the connection and stop mongod
 */
export const closeTestDB = async (): Promise<void> => {
    if (mongoose.connection.readyState !== 0) {
        await mongoose.connection.dropDatabase();
        await mongoose.connection.close();
    }

    if (mongoServer) {
        await mongoServer.stop();
        mongoServer = null;
    }
};

/**
 * Remove all data from all collections
 */
export const clearTestDB = async (): Promise<void> => {
    if (mongoose.connection.readyState === 0) {
        return;
    }

    const collections = mongoose.connection.collections;

    for (const key in collections) {
        const collection = collections[key];
        await collection.deleteMany({});
    }
};
