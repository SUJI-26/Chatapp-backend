import express from "express";
import { getUsers, getUserById, updateProfile } from "../controllers/user.controller.js";
import { protect } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.use(protect); // every route below requires authentication

router.get("/", getUsers);
router.put("/profile", updateProfile);
router.get("/:id", getUserById);

export default router;
