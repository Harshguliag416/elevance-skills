require("dotenv").config();
const mongoose = require("mongoose");
const database = process.env.DATABASE_URL;
const url = database;
console.log("Attempting to connect to:", url ? url.substring(0, 20) + "..." : "undefined");

module.exports.connect = () => {
  return mongoose
    .connect(url)
    .then(() => console.log("Database is connected"))
    .catch((err) => {
      console.error("Database connection error:", err);
      throw err;
    });
};