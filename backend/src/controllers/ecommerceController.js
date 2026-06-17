import { seedProducts } from "../constants/index.js";
import db from "../models/index.js";
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

		return res.status(201).json({
			url: session?.url || "",
			message: "Order created",
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
