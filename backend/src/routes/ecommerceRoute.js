import express from "express";
import {
	seedProductsController,
	fetchAllProductsController,
	createCheckoutSessionController,
	verifyPayment,
	seedPlansController,
	fetchAllPlans,
	createRazorpaySubscriptionController,
	verifySubscription,
} from "../controllers/ecommerceController.js";
import { checkUserAuth } from "../middleware/index.js";

const router = express.Router();

router.post("/seed", seedProductsController);
router.get("/products", checkUserAuth, fetchAllProductsController);
router.post("/plans", seedPlansController);
router.get("/plans", fetchAllPlans);
router.post("/create-checkout", checkUserAuth, createCheckoutSessionController);
router.post("/verify-payment", checkUserAuth, verifyPayment);
router.post(
	"/create-subscription",
	checkUserAuth,
	createRazorpaySubscriptionController
);
router.post("/verify-subscription", checkUserAuth, verifySubscription);
export default router;
