import express from "express";
import {
  changeFirstLoginPassword,
  changePassword,
  getCurrentUser,
  login,
  logout
} from "../controllers/authController.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { requireAuth } from "../middleware/auth.js";

export const authRouter = express.Router();

authRouter.post("/login", asyncHandler(login));
authRouter.get("/me", requireAuth, asyncHandler(getCurrentUser));
authRouter.post("/logout", requireAuth, asyncHandler(logout));
authRouter.post("/change-password", requireAuth, asyncHandler(changePassword));
authRouter.post("/first-login-password", requireAuth, asyncHandler(changeFirstLoginPassword));
