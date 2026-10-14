// Seed script — populates MongoDB with the 32 TOMATO menu items and copies
// their images into backend/uploads/ so /images/<file> serves them.
// Usage: node scripts/seed.js   (requires MONGO_URL in backend/.env)
import mongoose from "mongoose";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import "dotenv/config";
import foodModel from "../models/foodModel.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const seedData = JSON.parse(
  fs.readFileSync(path.join(__dirname, "seed-data.json"), "utf-8")
);
const frontendAssets = path.resolve(
  __dirname,
  "../../frontend/src/assets/frontend_assets"
);
const uploadsDir = path.resolve(__dirname, "../uploads");
fs.mkdirSync(uploadsDir, { recursive: true });

const run = async () => {
  await mongoose.connect(process.env.MONGO_URL);
  console.log("DB Connected");

  await foodModel.deleteMany({});

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
  }

  const count = await foodModel.countDocuments();
  console.log(`Seeded ${count} food items`);
  await mongoose.disconnect();
};

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
