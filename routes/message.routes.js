import express from "express";
import { body } from "express-validator";
import { getMessages, sendMessage } from "../controllers/message.controller.js";
import { protect } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";

const router = express.Router();

router.use(protect);

router.get("/:conversationId", getMessages);

router.post(
  "/",
  [body("receiverId").notEmpty().withMessage("receiverId is required")],
  validate,
  sendMessage
);

export default router;
