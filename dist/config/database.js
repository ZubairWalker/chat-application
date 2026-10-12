import mongoose from 'mongoose';
async function connectDB() {
    const mongoURI = process.env.mongodb;
    if (!mongoURI) {
        throw new Error('MongoDB connection string is not defined in the environment variables.');
    }
    try {
        await mongoose.connect(mongoURI);
        console.log('Connected to MongoDB successfully');
        return;
    }
    catch (error) {
        console.log('error Connecting to mongodb: ', error);
    }
}
function isDbConnected() {
    return mongoose.connection.readyState === 1;
}
export { connectDB, isDbConnected };
