import express from "express";
import { login, authCallback, fetchProtectedResource } from "../controllers/authController";

const router = express.Router();

router.get("/login", login);
router.get("/callback", authCallback);
router.get("/protected-resource", fetchProtectedResource);

export default router;
