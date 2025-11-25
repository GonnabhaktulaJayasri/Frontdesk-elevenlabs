import crypto from "crypto";

export const authMiddleware = (req, res, next) => {
  console.log("====== WEBHOOK RECEIVED ======");
  console.log("Headers:", req.headers);
  console.log("Signature from Header:", req.headers["x-elevenlabs-signature"]);
  console.log("Raw Body:", req.rawBody);

  const signature = req.headers["x-elevenlabs-signature"];
  const body = req.rawBody;

  if (!body) {
    console.log("❌ Missing RAW BODY (rawBody not captured)");
    return res.status(400).json({ error: "Missing raw body" });
  }

  const digest = crypto
    .createHmac("sha256", process.env.WEBHOOK_SECRET)
    .update(body)
    .digest("hex");

  console.log("Calculated Digest:", digest);
  console.log("====================================");

  if (signature === digest) {
    console.log("✅ Signature Verified Successfully!");
    return next();
  }

  console.log("❌ INVALID SIGNATURE");
  console.log("Provided Signature:", signature);
  console.log("Expected Digest:", digest);

  return res.status(401).json({ error: "Invalid signature" });
};
