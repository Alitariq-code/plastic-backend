import express from 'express';
import dotenv from 'dotenv';
import authRoutes from './routes/authRoutes';
import connectDB from './config/db';
import morgan from 'morgan';
import cors from 'cors';
import Opportunity from './routes/opportunity.routes';
import webHookRoutes from './routes/webhook.routes';
dotenv.config();

// Connect to MongoDB
connectDB();

const app = express();
app.use(express.json());
app.use(morgan('dev'));
app.use(
  cors({
    origin: [
      'http://localhost:5173',
      'https://surgery.axdashboard.com',
      'https://spa.axdashboard.com',
    ],
    credentials: true,
  })
);

app.use('/auth', authRoutes);
app.use('/opportunities', Opportunity);
app.use('/webhook', webHookRoutes);

// ✅ New POST endpoint
// app.post('/api/opportunity', (req, res) => {
//   console.log('Received opportunity data:', req.body);
//   res.status(200).json({ message: 'Opportunity received', data: req.body });
// });

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
