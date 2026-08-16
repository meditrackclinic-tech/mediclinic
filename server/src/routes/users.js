import express from "express";
import {
  createUser,
  deleteUser,
  getStaffEmailStatus,
  listStaffRoles,
  listStaffUsers,
  resetUserPassword,
  sendStaffEmailTest,
  updateUser
} from "../controllers/usersController.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

export const usersRouter = express.Router();

usersRouter.use(requireAuth, requireRole("admin"));

usersRouter.get("/", asyncHandler(listStaffUsers));
usersRouter.get("/roles", asyncHandler(listStaffRoles));
usersRouter.get("/email-status", asyncHandler(getStaffEmailStatus));
usersRouter.post("/email-test", asyncHandler(sendStaffEmailTest));
usersRouter.post("/", asyncHandler(createUser));
usersRouter.patch("/:id", asyncHandler(updateUser));
usersRouter.post("/:id/reset-password", asyncHandler(resetUserPassword));
usersRouter.delete("/:id", asyncHandler(deleteUser));
