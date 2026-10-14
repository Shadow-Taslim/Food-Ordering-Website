// All-in-one preview/demo boot: when no MONGO_URL is provided, starts an
// in-memory MongoDB, seeds the 32-item demo menu on first run, then boots
// the API server (which also serves the built frontend + admin apps).
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

if (!process.env.MONGO_URL) {
  const { MongoMemoryServer } = await import("mongodb-memory-server");
  const mongo = await MongoMemoryServer.create();
  process.env.MONGO_URL = mongo.getUri("food-delivery");
  console.log("[preview] in-memory MongoDB started:", process.env.MONGO_URL);
}

process.env.JWT_SECRET = process.env.JWT_SECRET || "preview_demo_secret";
process.env.SALT = process.env.SALT || "10";

// seed demo menu when the foods collection is empty
const mongoose = (await import("mongoose")).default;
await mongoose.connect(process.env.MONGO_URL);
const { default: foodModel } = await import("./models/foodModel.js");
const count = await foodModel.countDocuments();
if (count === 0) {
  const seedData = JSON.parse(
    fs.readFileSync(path.join(__dirname, "scripts/seed-data.json"), "utf-8")
  );
  const frontendAssets = path.resolve(
    __dirname,
    "../frontend/src/assets/frontend_assets"
  );
  const uploadsDir = path.resolve(__dirname, "uploads");
  fs.mkdirSync(uploadsDir, { recursive: true });
  for (const item of seedData) {
    const srcImage = path.join(frontendAssets, item.image);
    const destImage = `${Date.now()}${item.image}`;
    if (fs.existsSync(srcImage)) {
      fs.copyFileSync(srcImage, path.join(uploadsDir, destImage));
    }
    await foodModel.create({
      name: item.name,
      description: item.description,
      price: item.price,
      category: item.category,
      image: destImage,
    });
    await new Promise((r) => setTimeout(r, 5)); // unique timestamped filenames
  }
  console.log(`[preview] seeded ${await foodModel.countDocuments()} food items`);
} else {
  console.log(`[preview] foods collection already has ${count} items`);
}

// seed demo accounts when there are no users yet
const { default: userModel } = await import("./models/userModel.js");
const userCount = await userModel.countDocuments();
if (userCount === 0) {
  const bcrypt = (await import("bcrypt")).default;
  const salt = await bcrypt.genSalt(Number(process.env.SALT));
  await userModel.create({
    name: "Demo Admin",
    email: "admin@demo.com",
    password: await bcrypt.hash("admin123", salt),
    role: "admin",
  });
  await userModel.create({
    name: "Demo Customer",
    email: "customer@demo.com",
    password: await bcrypt.hash("customer123", salt),
    role: "user",
  });
  console.log("[preview] seeded demo accounts: admin@demo.com / customer@demo.com");
}
await mongoose.disconnect();

await import("./server.js");
