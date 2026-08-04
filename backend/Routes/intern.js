const express = require("express");
const router = express.Router();
const User = require("../Model/User");
const { verifyFirebaseUser } = require("../middleware/auth");

/**
 * GET /api/interns
 * Fetch all users (interns) with first name + last name.
 * Returns _id, name, email sorted alphabetically by name.
 */
router.get("/", verifyFirebaseUser, async (req, res) => {
  try {
    const interns = await User.find({})
      .select("name email uid phone")
      .sort({ name: 1 });

    return res.status(200).json({ success: true, data: interns });
  } catch (error) {
    console.error("[interns] GET error:", error);
    return res
      .status(500)
      .json({ success: false, errors: ["Failed to fetch interns"] });
  }
});

module.exports = router;