const express = require("express");
const rateLimit = require("express-rate-limit");
const { requireAuth } = require("../middleware/requireAuth");
const { askSalesAssistant } = require("../services/salesChatService");

const router = express.Router();

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 12,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many AI questions. Please wait and try again.",
  },
});

router.post("/sales-chat", requireAuth, limiter, async (req, res) => {
  try {
    const result = await askSalesAssistant({
      ...(req.body || {}),
      user: req.user,
    });

    return res.json(result);
  } catch (error) {
    console.error("Sales AI error:", error);

    return res.status(500).json({
      success: false,
      message: "The sales assistant could not answer this question",
      error: process.env.NODE_ENV === "production" ? undefined : error.message,
    });
  }
});

module.exports = router;
