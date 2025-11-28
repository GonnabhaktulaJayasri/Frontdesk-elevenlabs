// app.js
import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import callRoutes from "../src/routes/calls.js";
import toolsRoutes from "../src/routes/tools.js";
import authRoutes from "../src/routes/auth.js";
import agentConfigRoutes from "../src/routes/agent.js";
import scheduledCallRoutes from "../src/routes/scheduledCalls.js";
import voiceRoutes from "./routes/voices.js"; 
import connectDB from "./config/db.js";
import appointmentRoutes from './routes/appointments.js';
import staffRoutes from './routes/staff.js';
import patientRoutes from './routes/patients.js';

const app = express();

app.use(cors());
app.use(bodyParser.json());
app.use(express.json()); // parse application/json
app.use(express.urlencoded({ extended: true }));
app.use(
  express.json({
    verify: (req, res, buf) => {
      req.rawBody = buf.toString();
    },
  })
);
app.use(express.urlencoded({ extended: true }));

connectDB();


// Routes
app.use("/api/auth", authRoutes);
app.use("/api/calls", callRoutes);
app.use("/api/tools", toolsRoutes);
app.use("/api/agent", agentConfigRoutes);
app.use("/api/scheduled-calls", scheduledCallRoutes);
app.use("/api/voices", voiceRoutes);
app.use('/api/appointments', appointmentRoutes);

// Staff & Doctor management
app.use('/api/staff', staffRoutes);

// Patient management
app.use('/api/patients', patientRoutes);

// Error handling
app.use((error, req, res, next) => {
  console.error("Error:", error);
  res.status(500).json({
    error: "Internal server error",
    message: error.message,
  });
});

export default app;
