import express from "express";
import {
	seedProductsController,
	fetchAllProductsController,
	createCheckoutSessionController,
	verifyPayment,
} from "../controllers/ecommerceController.js";
import { checkUserAuth } from "../middleware/index.js";

const router = express.Router();

router.post("/seed", seedProductsController);
router.get("/products", checkUserAuth, fetchAllProductsController);

router.post("/create-checkout", checkUserAuth, createCheckoutSessionController);
router.post("/verify-payment", checkUserAuth,verifyPayment);

export default router;
