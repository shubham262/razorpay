import razorpay from "../config/razorpay.js";
import { seedPlans, seedProducts } from "../constants/index.js";
import db from "../models/index.js";
import crypto from "crypto";
const { Product, Order, Subscription, Plan } = db;

export const seedProductsController = async (req, res) => {
	try {
		await Product.deleteMany({});

		const seededProducts = await Product.insertMany(seedProducts);

		return res.status(201).json({
			success: true,
			message: "Database successfully seeded with PW curriculum.",
			count: seededProducts.length,
			data: seededProducts,
		});
	} catch (error) {
		console.error("[seedProductsController] Critical Error:", error);

		return res.status(500).json({
			success: false,
			error: "Failed to seed products",
			details: error.message,
		});
	}
};
export const fetchAllProductsController = async (req, res) => {
	try {
		const products = await Product.find();
		return res.status(201).json({
			success: true,
			message: "Fetch all products successfully",
			products,
		});
	} catch (error) {
		console.error("[fetchAllProductsController] Critical Error:", error);

		return res.status(500).json({
			success: false,
			error: "Failed to fetch products",
			details: error.message,
		});
	}
};

export const createCheckoutSessionController = async (req, res) => {
	try {
		const userId = req.user.id;
		const { items = [] } = req.body || {};
		if (!items || items.length === 0) {
			return res.status(500).json({
				message: "Need valid items array",
			});
		}

		const orderSnapShot = [];
		let amountInPaise = 0;

		for (const item of items) {
			const product = await Product.findById(item?._id);
			if (!product) {
				return res.status(500).json({
					message: "Product does not exist",
				});
			}

			amountInPaise += product.price || 0;

			orderSnapShot.push({
				productId: product?._id,
				name: product?.name,
				slug: product?.slug,
				quantity: 1,
				unitAmount: product.price,
				lineTotal: product.price,
				currency: product.currency,
			});
		}
		const razorpayOptions = {
			amount: amountInPaise,
			currency: "INR",
			receipt: `rcpt_${userId.substring(0, 5)}_${Date.now()}`,
		};

		const razorpayOrder = await razorpay.orders.create(razorpayOptions);
		const order = await Order.create({
			userId,
			items: orderSnapShot,
			subtotalAmount: amountInPaise,
			totalAmount: amountInPaise,
			currency: "inr",
			status: "pending",
			razorpayOrderId: razorpayOrder.id,
		});

		return res.status(201).json({
			success: true,
			message: "Razorpay Order created successfully",
			order_id: razorpayOrder.id,
			amount: amountInPaise,
			currency: "INR",
			dbOrderId: order._id,
		});
	} catch (error) {
		console.error("[createCheckoutSessionController] Critical Error:", error);

		return res.status(500).json({
			success: false,
			error: "Failed to create checkout",
			details: error.message,
		});
	}
};

export const verifyPayment = async (req, res) => {
	try {
		const { razorpay_order_id, razorpay_payment_id, razorpay_signature } =
			req.body;

		if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
			return res.status(400).json({
				success: false,
				error: "Missing required Razorpay parameters",
			});
		}

		const data = razorpay_order_id + "|" + razorpay_payment_id;
		const expectedSignature = crypto
			.createHmac("sha256", process.env.RAZORPAY_SECRET_KEY)
			.update(data.toString())
			.digest("hex");

		const isAuthentic = expectedSignature === razorpay_signature;
		if (!isAuthentic) {
			return res.status(400).json({
				success: false,
				error: "Invalid payment signature. Transaction validation failed.",
			});
		}

		const order = await Order.findOneAndUpdate(
			{ razorpayOrderId: razorpay_order_id },
			{
				status: "paid",
				razorpayPaymentId: razorpay_payment_id,
				paidAt: new Date(),
			},
			{ returnDocument: "after" }
		);
		if (!order) {
			return res.status(404).json({
				success: false,
				error: "Order record not found in the database",
			});
		}
		return res.status(200).json({
			success: true,
			message: "Payment successfully verified and order updated",
			order,
		});
	} catch (error) {
		console.error("[verifyPayment] Critical Error:", error);
		return res.status(500).json({
			success: false,
			error: "Failed to create checkout",
			details: error.message,
		});
	}
};

export const seedPlansController = async (req, res) => {
	try {
		const seededPlan = await Plan.insertMany(seedPlans);

		return res.status(201).json({
			success: true,
			message: "Database successfully seeded with PW curriculum.",
			count: seededPlan.length,
			data: seededPlan,
		});
	} catch (error) {
		console.error("[seedPlansController] Critical Error:", error);

		return res.status(500).json({
			success: false,
			error: "Failed to seed products",
			details: error.message,
		});
	}
};
export const fetchAllPlans = async (req, res) => {
	try {
		const plans = await Plan.find();
		return res.status(201).json({
			success: true,
			message: "Fetch all Plans successfully",
			plans,
		});
	} catch (error) {
		console.error("[fetchAllPlans] Critical Error:", error);

		return res.status(500).json({
			success: false,
			error: "Failed to fetch plans",
			details: error.message,
		});
	}
};

export const createRazorpaySubscriptionController = async (req, res) => {
	try {
		const userId = req.user.id;
		const { planId, interval } = req.body;

		if (!planId || !interval) {
			return res
				.status(400)
				.json({ message: "Plan ID and interval are required" });
		}

		const dbPlan = await Plan.findById(planId);
		if (!dbPlan) {
			return res.status(404).json({ message: "Plan not found" });
		}

		const pricingOption = dbPlan.pricingOptions.find(
			(opt) => opt.interval === interval
		);
		if (!pricingOption) {
			return res.status(400).json({
				message: `Pricing for interval '${interval}' not found on this plan.`,
			});
		}

		const totalCount = interval === "month" ? 120 : 10;

		const subscriptionOptions = {
			plan_id: pricingOption.razorpayPlanId,
			total_count: totalCount,
			customer_notify: 0,
		};

		const razorpaySubscription = await razorpay.subscriptions.create(
			subscriptionOptions
		);

		const newSubscription = await Subscription.create({
			userId,
			planId: dbPlan._id,
			razorpaySubscriptionId: razorpaySubscription.id,
			status: "created",
		});

		return res.status(201).json({
			success: true,
			message: "Subscription created successfully",
			subscription_id: razorpaySubscription.id,
			dbSubscriptionId: newSubscription._id,
			name: dbPlan?.name,
			description: interval === "month" ? "Monthly Access" : "Yearly Access",
		});
	} catch (error) {
		console.error(
			"[createRazorpaySubscriptionController] Critical Error:",
			error
		);
		return res.status(500).json({
			success: false,
			error: "Failed to create subscription",
			details: error.message,
		});
	}
};

export const verifySubscription = async (req, res) => {
	try {
		// 1. Extract the subscription-specific payload from the frontend handler
		const {
			razorpay_payment_id,
			razorpay_subscription_id,
			razorpay_signature,
		} = req.body;

		// 2. Parameter Validation
		if (
			!razorpay_payment_id ||
			!razorpay_subscription_id ||
			!razorpay_signature
		) {
			return res.status(400).json({
				success: false,
				error: "Missing required Razorpay parameters for subscription",
			});
		}

		const data = razorpay_payment_id + "|" + razorpay_subscription_id;

		const expectedSignature = crypto
			.createHmac("sha256", process.env.RAZORPAY_SECRET_KEY)
			.update(data.toString())
			.digest("hex");

		const isAuthentic = expectedSignature === razorpay_signature;

		if (!isAuthentic) {
			return res.status(400).json({
				success: false,
				error: "Invalid subscription signature. Transaction validation failed.",
			});
		}

		const subscription = await Subscription.findOneAndUpdate(
			{ razorpaySubscriptionId: razorpay_subscription_id },
			{
				status: "active",
			},
			{ returnDocument: "after" }
		);

		if (!subscription) {
			return res.status(404).json({
				success: false,
				error: "Subscription record not found in the database",
			});
		}

		return res.status(200).json({
			success: true,
			message: "Subscription successfully verified and activated",
			subscription,
		});
	} catch (error) {
		console.error("[verifySubscription] Critical Error:", error);
		return res.status(500).json({
			success: false,
			error: "Failed to verify subscription",
			details: error.message,
		});
	}
};

export const handleRazorpayWebhook = async (req, res) => {
	try {
		const webhookSignature = req.headers["x-razorpay-signature"];
		const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
		console.log("hello therre", webhookSecret);
		const expectedSignature = crypto
			.createHmac("sha256", webhookSecret)
			.update(req.body)
			.digest("hex");

		if (expectedSignature !== webhookSignature) {
			console.error("🚨 CRITICAL: Invalid Webhook Signature Detected.");
			return res.status(400).send("Invalid signature");
		}

		const payload = JSON.parse(req.body.toString());
		const event = payload.event;

		switch (event) {
			case "subscription.charged": {
				console.log("I reached herer==>", payload);
				const subscriptionEntity = payload.payload.subscription.entity;

				await Subscription.findOneAndUpdate(
					{ razorpaySubscriptionId: subscriptionEntity.id },
					{
						status: "active",
						currentPeriodEnd: new Date(subscriptionEntity.current_end * 1000),
					}
				);

				break;
			}

			case "subscription.halted":
			case "subscription.cancelled": {
				// The user's card failed too many times, or they cancelled
				const subscriptionEntity = payload.payload.subscription.entity;

				await Subscription.findOneAndUpdate(
					{ razorpaySubscriptionId: subscriptionEntity.id },
					{ status: event.split(".")[1] } // sets status to 'halted' or 'cancelled'
				);
				console.log(
					`❌ Subscription ${subscriptionEntity.id} has been ${event}. Access revoked.`
				);
				break;
			}

			default:
				console.log(`Unhandled webhook event: ${event}`);
		}

		return res.status(200).json({ received: true });
	} catch (error) {
		console.error("[Webhook Error]:", error);
		return res.status(500).send("Webhook handler failed");
	}
};
