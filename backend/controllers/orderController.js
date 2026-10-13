import orderModel from "../models/orderModel.js";
import userModel from "../models/userModel.js";
import Stripe from "stripe";

// Stripe is optional at boot so the rest of the API still runs without keys,
// but every payment endpoint fails loudly if the key is missing.
const getStripe = () => {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY is not configured on the server");
  }
  return new Stripe(process.env.STRIPE_SECRET_KEY);
};

// placing user order for frontend — creates the order, then a Stripe
// PaymentIntent whose metadata carries the orderId for webhook reconciliation.
const placeOrder = async (req, res) => {
  try {
    const stripe = getStripe();

    const newOrder = new orderModel({
      userId: req.body.userId,
      items: req.body.items,
      amount: req.body.amount,
      address: req.body.address,
    });
    await newOrder.save();

    let paymentIntent;
    try {
      paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(req.body.amount * 100), // Stripe expects cents
        currency: "usd",
        metadata: { orderId: newOrder._id.toString() },
        automatic_payment_methods: { enabled: true },
      });
    } catch (stripeError) {
      // roll back so a failed payment setup never leaves an orphan order
      await orderModel.findByIdAndDelete(newOrder._id);
      throw stripeError;
    }

    await userModel.findByIdAndUpdate(req.body.userId, { cartData: {} });
    newOrder.paymentIntentId = paymentIntent.id;
    await newOrder.save();

    console.log(
      `[Stripe] PaymentIntent ${paymentIntent.id} created for order ${newOrder._id} amount $${req.body.amount}`
    );

    res.json({
      success: true,
      clientSecret: paymentIntent.client_secret,
      orderId: newOrder._id,
    });
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: error.message || "Error" });
  }
};

// Stripe webhook — must be mounted with express.raw() BEFORE express.json().
// Stripe signs the payload; we verify the signature, then reconcile order state.
const stripeWebhook = async (req, res) => {
  const stripe = getStripe();
  const sig = req.headers["stripe-signature"];

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.log(`[Stripe webhook] signature verification failed: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  console.log(`[Stripe webhook] received event: ${event.type}`);

  try {
    switch (event.type) {
      case "payment_intent.succeeded": {
        const paymentIntent = event.data.object;
        const orderId = paymentIntent.metadata.orderId;
        await orderModel.findByIdAndUpdate(orderId, { payment: true });
        console.log(
          `[Stripe webhook] payment_intent.succeeded ${paymentIntent.id} -> order ${orderId} marked PAID`
        );
        break;
      }
      case "payment_intent.payment_failed": {
        const paymentIntent = event.data.object;
        const orderId = paymentIntent.metadata.orderId;
        await orderModel.findByIdAndUpdate(orderId, {
          payment: false,
          status: "Payment Failed",
        });
        console.log(
          `[Stripe webhook] payment_intent.payment_failed ${paymentIntent.id} -> order ${orderId} marked Payment Failed`
        );
        break;
      }
      default:
        console.log(`[Stripe webhook] unhandled event type ${event.type}`);
    }
    res.json({ received: true });
  } catch (error) {
    console.log(error);
    res.status(500).json({ received: false });
  }
};

// client-side confirmation fallback (the webhook is the source of truth;
// this only re-confirms with Stripe when the user lands back on /verify)
const verifyOrder = async (req, res) => {
  const { orderId, success } = req.body;
  try {
    const order = await orderModel.findById(orderId);
    if (!order) {
      return res.json({ success: false, message: "Order not found" });
    }

    if (order.payment) {
      // webhook already marked it paid
      return res.json({ success: true, message: "Paid" });
    }

    if (success == "true" && order.paymentIntentId) {
      const stripe = getStripe();
      const paymentIntent = await stripe.paymentIntents.retrieve(
        order.paymentIntentId
      );
      if (paymentIntent.status === "succeeded") {
        await orderModel.findByIdAndUpdate(orderId, { payment: true });
        return res.json({ success: true, message: "Paid" });
      }
    }

    await orderModel.findByIdAndUpdate(orderId, { status: "Payment Failed" });
    res.json({ success: false, message: "Not Paid" });
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: "Error" });
  }
};

// user orders for frontend
const userOrders = async (req, res) => {
  try {
    const orders = await orderModel.find({ userId: req.body.userId });
    res.json({ success: true, data: orders });
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: "Error" });
  }
};

// Listing orders for admin pannel
const listOrders = async (req, res) => {
  try {
    let userData = await userModel.findById(req.body.userId);
    if (userData && userData.role === "admin") {
      const orders = await orderModel.find({});
      res.json({ success: true, data: orders });
    } else {
      res.json({ success: false, message: "You are not admin" });
    }
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: "Error" });
  }
};

// api for updating status
const updateStatus = async (req, res) => {
  try {
    let userData = await userModel.findById(req.body.userId);
    if (userData && userData.role === "admin") {
      await orderModel.findByIdAndUpdate(req.body.orderId, {
        status: req.body.status,
      });
      res.json({ success: true, message: "Status Updated Successfully" });
    }else{
      res.json({ success: false, message: "You are not an admin" });
    }
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: "Error" });
  }
};

export { placeOrder, verifyOrder, userOrders, listOrders, updateStatus, stripeWebhook };
