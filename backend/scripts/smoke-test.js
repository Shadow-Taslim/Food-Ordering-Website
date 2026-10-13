// End-to-end smoke test — boots an in-memory MongoDB, starts the real API
// server, and exercises every MVP flow over HTTP:
//   register -> login (JWT) -> food list -> cart add/get -> order place
//   -> Stripe webhook (real signature verification via a test header)
//   -> order marked paid -> admin role check -> status update
// Usage: node scripts/smoke-test.js
import { MongoMemoryServer } from "mongodb-memory-server";
import Stripe from "stripe";
import mongoose from "mongoose";

const PORT = 4100;
const BASE = `http://localhost:${PORT}`;
const WEBHOOK_SECRET = "whsec_smoketestsecret";

process.env.PORT = PORT;
process.env.JWT_SECRET = "smoke_test_jwt_secret";
process.env.SALT = "10";
// Dummy key — placeOrder must fail gracefully (no real charge is attempted)
process.env.STRIPE_SECRET_KEY = "sk_test_smoke_dummy";
process.env.STRIPE_WEBHOOK_SECRET = WEBHOOK_SECRET;

let passed = 0;
let failed = 0;
const check = (name, cond) => {
  if (cond) {
    passed++;
    console.log(`  PASS  ${name}`);
  } else {
    failed++;
    console.log(`  FAIL  ${name}`);
  }
};

const mongo = await MongoMemoryServer.create();
process.env.MONGO_URL = mongo.getUri();

await import("../server.js"); // boots express on PORT
await new Promise((r) => setTimeout(r, 1500));

const post = async (path, body, headers = {}) => {
  const res = await fetch(BASE + path, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
  return res.json();
};

try {
  // 1. Registration + bcrypt storage
  const reg = await post("/api/user/register", {
    name: "Smoke Tester",
    email: "smoke@test.com",
    password: "password123",
  });
  check("POST /api/user/register returns JWT", reg.success && !!reg.token);
  const stored = await mongoose.connection.db
    .collection("users")
    .findOne({ email: "smoke@test.com" });
  check(
    "password stored as bcrypt hash, not plaintext",
    stored.password.startsWith("$2") && stored.password !== "password123"
  );

  // 2. Login
  const login = await post("/api/user/login", {
    email: "smoke@test.com",
    password: "password123",
  });
  check("POST /api/user/login returns JWT", login.success && !!login.token);
  const token = login.token;

  // 3. JWT guard actually guards
  const noAuth = await post("/api/cart/get", {});
  check("cart endpoint rejects requests without JWT", noAuth.success === false);

  // 4. Seed one food item and list it
  const { default: foodModel } = await import("../models/foodModel.js");
  const food = await foodModel.create({
    name: "Smoke Salad",
    description: "test item",
    price: 10,
    category: "Salad",
    image: "smoke.png",
  });
  const list = await (await fetch(BASE + "/api/food/list")).json();
  check(
    "GET /api/food/list returns seeded item",
    list.success && list.data.length === 1 && list.data[0].name === "Smoke Salad"
  );

  // 5. Cart persistence
  await post("/api/cart/add", { itemId: food._id.toString() }, { token });
  await post("/api/cart/add", { itemId: food._id.toString() }, { token });
  const cart = await post("/api/cart/get", {}, { token });
  check(
    "cart persists 2 additions server-side",
    cart.success && cart.cartData[food._id.toString()] === 2
  );

  // 6. placeOrder with a dummy Stripe key must fail gracefully (no crash)
  const placed = await post(
    "/api/order/place",
    {
      items: [{ ...food.toObject(), quantity: 2 }],
      amount: 22,
      address: { street: "1 Test Way" },
    },
    { token }
  );
  check(
    "placeOrder fails gracefully without a real Stripe key",
    placed.success === false
  );

  // 7. Webhook: build a REAL Stripe-signed test event and POST it raw
  const { default: orderModel } = await import("../models/orderModel.js");
  const order = await orderModel.create({
    userId: stored._id.toString(),
    items: [{ name: "Smoke Salad", quantity: 2 }],
    amount: 22,
    address: { street: "1 Test Way" },
    paymentIntentId: "pi_smoke_123",
  });

  const payload = JSON.stringify({
    id: "evt_smoke_1",
    object: "event",
    type: "payment_intent.succeeded",
    data: {
      object: {
        id: "pi_smoke_123",
        object: "payment_intent",
        status: "succeeded",
        metadata: { orderId: order._id.toString() },
      },
    },
  });
  const stripe = new Stripe("sk_test_smoke_dummy");
  const header = stripe.webhooks.generateTestHeaderString({
    payload,
    secret: WEBHOOK_SECRET,
  });
  const whRes = await fetch(BASE + "/api/order/webhook", {
    method: "POST",
    headers: { "Content-Type": "application/json", "stripe-signature": header },
    body: payload,
  });
  check("POST /api/order/webhook accepts a validly signed event", whRes.ok);

  const updated = await orderModel.findById(order._id);
  check(
    "webhook payment_intent.succeeded marks order paid",
    updated.payment === true
  );

  // 8. Bad signature must be rejected
  const badRes = await fetch(BASE + "/api/order/webhook", {
    method: "POST",
    headers: { "Content-Type": "application/json", "stripe-signature": "t=1,v1=bad" },
    body: payload,
  });
  check("webhook rejects invalid signatures (HTTP 400)", badRes.status === 400);

  // 9. Admin role restriction
  const notAdmin = await post(
    "/api/order/status",
    { orderId: order._id, status: "Out for Delivery" },
    { token }
  );
  check(
    "non-admin cannot update order status",
    notAdmin.success === false
  );

  await mongoose.connection.db
    .collection("users")
    .updateOne({ email: "smoke@test.com" }, { $set: { role: "admin" } });
  const adminUpdate = await post(
    "/api/order/status",
    { orderId: order._id.toString(), status: "Out for Delivery" },
    { token }
  );
  const finalOrder = await orderModel.findById(order._id);
  check(
    "admin can update order status",
    adminUpdate.success && finalOrder.status === "Out for Delivery"
  );

  // 10. User order history
  const myOrders = await post("/api/order/userorders", {}, { token });
  check(
    "user can list their own orders",
    myOrders.success && myOrders.data.length === 1
  );
} catch (e) {
  failed++;
  console.error("  FAIL  unexpected error:", e);
}

console.log(`\n${passed} passed, ${failed} failed`);
await mongoose.disconnect();
await mongo.stop();
process.exit(failed ? 1 : 0);
