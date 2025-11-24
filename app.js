// app.js
import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import twilioRoutes from "./src/routes/twilio.js";
import toolsRoutes from "./src/routes/tools.js";
import authRoutes from "./src/routes/auth.js";
import agentConfigRoutes from "./src/routes/agentConfig.js";
import { verifyWebhookSignature } from "./src/middleware/webhookAuth.js";
import dotenv from "dotenv";

dotenv.config();

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

// Routes
app.use("/api/calls", twilioRoutes);
app.use("/api/tools", toolsRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/agent", agentConfigRoutes);

// Error handling
app.use((error, req, res, next) => {
  console.error("Error:", error);
  res.status(500).json({
    error: "Internal server error",
    message: error.message,
  });
});

export default app;
