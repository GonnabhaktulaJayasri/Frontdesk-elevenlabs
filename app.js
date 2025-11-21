// app.js
import express from "express";
import twilioRoutes from "./src/routes/twilio.js";
import toolsRoutes from "./src/routes/tools.js";
import { verifyWebhookSignature } from "./src/middleware/webhookAuth.js";
import dotenv from "dotenv";

dotenv.config();

const app = express();

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
app.use("/api/tools", verifyWebhookSignature, toolsRoutes);

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "healthy" });
});

// Error handling
app.use((error, req, res, next) => {
  console.error("Error:", error);
  res.status(500).json({
    error: "Internal server error",
    message: error.message,
  });
});

export default app;
