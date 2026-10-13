import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { connectDB } from "./config/db.js";
import foodRouter from "./routes/foodRoute.js";
import userRouter from "./routes/userRoute.js";
import "dotenv/config";
import cartRouter from "./routes/cartRoute.js";
import orderRouter from "./routes/orderRoute.js";
import { stripeWebhook } from "./controllers/orderController.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// app config
const app = express();
const port =process.env.PORT || 4000;

// Stripe webhook MUST be registered before express.json() — signature
// verification needs the raw, unparsed request body.
app.post(
  "/api/order/webhook",
  express.raw({ type: "application/json" }),
  stripeWebhook
);

//middlewares
app.use(express.json());
app.use(cors());

// DB connection
connectDB();

// api endpoints
app.use("/api/food", foodRouter);
app.use("/images", express.static("uploads"));
app.use("/api/user", userRouter);
app.use("/api/cart", cartRouter);
app.use("/api/order", orderRouter);

// Optional all-in-one hosting: when the React production builds exist next to
// the backend (Docker image / preview deployment), serve them from the same
// origin — customer app at / and admin panel at /admin.
const frontendDist = path.resolve(__dirname, "../frontend/dist");
const adminDist = path.resolve(__dirname, "../admin/dist");

if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
} else {
  app.get("/", (req, res) => {
    res.send("API Working");
  });
}
if (fs.existsSync(adminDist)) {
  app.use("/admin", express.static(adminDist));
}

// SPA fallbacks (client-side routes must return index.html)
app.get("/admin/*", (req, res) => {
  res.sendFile(path.join(adminDist, "index.html"));
});
app.get("*", (req, res) => {
  if (fs.existsSync(frontendDist)) {
    res.sendFile(path.join(frontendDist, "index.html"));
  } else {
    res.status(404).send("Not found");
  }
});

app.listen(port, () => {
  console.log(`Server Started on port: ${port}`);
});
