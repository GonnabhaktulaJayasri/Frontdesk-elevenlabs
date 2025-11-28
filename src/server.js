import app from "./app.js";
import dotenv from "dotenv";
dotenv.config();
import scheduledCallJob from './jobs/scheduledCallJob.js';

const PORT = process.env.PORT || 3000;

// scheduledCallJob.start();

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
