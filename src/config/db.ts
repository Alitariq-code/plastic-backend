import mongoose, { ConnectOptions } from "mongoose";

const connectDB = async () => {
  try {
    // if (!process.env.MONGO_URI) {
    //   throw new Error("MONGO_URI is not defined in environment variables");
    // }
    
    const conn = await mongoose.connect("mongodb://root:root@hl-server-shard-00-00.ikb9u.mongodb.net:27017,hl-server-shard-00-01.ikb9u.mongodb.net:27017,hl-server-shard-00-02.ikb9u.mongodb.net:27017/?ssl=true&replicaSet=atlas-xgpjkc-shard-0&authSource=admin&retryWrites=true&w=majority&appName=HL-server", {
      useNewUrlParser: true, // Still required
    } as ConnectOptions); // Explicitly specify type
    
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`Error: ${(error as Error).message}`);
    process.exit(1);
  }
};

export default connectDB;
