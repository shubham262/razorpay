import razorpay from "../config/razorpay.js";
import { seedProducts } from "../constants/index.js";
import db from "../models/index.js";
import crypto from "crypto";
const { Product, Order } = db;

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
