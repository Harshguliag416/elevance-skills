const express = require("express");
const router = express.Router();
const Skill = require("../Model/Skill");
const User = require("../Model/User");
const { verifyFirebaseUser } = require("../middleware/auth");

/**
 * Middleware to verify the authenticated user is a superadmin.
 * Must be used after verifyFirebaseUser.
 */
async function requireSuperadmin(req, res, next) {
  try {
    const user = await User.findOne({ uid: req.authUser.uid });
    if (!user || user.role !== "superadmin") {
      return res
        .status(403)
        .json({ success: false, errors: ["Access denied. Superadmin privileges required."] });
    }
    req.userDoc = user;
    return next();
  } catch (error) {
    console.error("[skills] requireSuperadmin error:", error);
    return res
      .status(500)
      .json({ success: false, errors: ["Failed to verify admin privileges."] });
  }
}

/**
 * GET /api/skills
 * Fetch all skills with assigned interns populated.
 */
router.get("/", verifyFirebaseUser, async (req, res) => {
  try {
    const skills = await Skill.find({})
      .populate("assignedTo", "name email")
      .sort({ name: 1 });

    return res.status(200).json({ success: true, data: skills });
  } catch (error) {
    console.error("[skills] GET error:", error);
    return res
      .status(500)
      .json({ success: false, errors: ["Failed to fetch skills"] });
  }
});

/**
 * POST /api/skills
 * Add a new skill (superadmin only).
 * Body: { name, description? }
 */
router.post("/", verifyFirebaseUser, requireSuperadmin, async (req, res) => {
  try {
    const { name, description } = req.body;

    // --- Validation ---
    const errors = [];
    if (!name || !name.trim()) errors.push("Skill name is required");

    if (errors.length > 0) {
      return res.status(400).json({ success: false, errors });
    }

    // Check for duplicate name (case-insensitive)
    const existing = await Skill.findOne({
      name: { $regex: new RegExp(`^${name.trim()}$`, "i") },
    });
    if (existing) {
      return res
        .status(409)
        .json({ success: false, errors: ["A skill with this name already exists"] });
    }

    const skill = new Skill({
      name: name.trim(),
      description: description ? description.trim() : "",
    });

    await skill.save();

    return res.status(201).json({ success: true, data: skill });
  } catch (error) {
    console.error("[skills] POST error:", error);

    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((e) => e.message);
      return res.status(400).json({ success: false, errors: messages });
    }

    if (error.code === 11000) {
      return res
        .status(409)
        .json({ success: false, errors: ["A skill with this name already exists"] });
    }

    return res
      .status(500)
      .json({ success: false, errors: ["Failed to create skill"] });
  }
});

/**
 * POST /api/skills/assign
 * Assign a skill to an intern (superadmin only).
 * Body: { skillId, internId }
 */
router.post("/assign", verifyFirebaseUser, requireSuperadmin, async (req, res) => {
  try {
    const { skillId, internId } = req.body;

    // --- Validation ---
    const errors = [];
    if (!skillId) errors.push("Skill ID is required");
    if (!internId) errors.push("Intern ID is required");

    if (errors.length > 0) {
      return res.status(400).json({ success: false, errors });
    }

    // Verify skill exists
    const skill = await Skill.findById(skillId);
    if (!skill) {
      return res
        .status(404)
        .json({ success: false, errors: ["Skill not found"] });
    }

    // Verify intern exists
    const intern = await User.findById(internId);
    if (!intern) {
      return res
        .status(404)
        .json({ success: false, errors: ["Intern not found"] });
    }

    // Check if already assigned
    if (skill.assignedTo.includes(internId)) {
      return res
        .status(409)
        .json({ success: false, errors: ["This skill is already assigned to this intern"] });
    }

    skill.assignedTo.push(internId);
    await skill.save();

    // Return populated skill
    await skill.populate("assignedTo", "name email");

    return res.status(200).json({ success: true, data: skill });
  } catch (error) {
    console.error("[skills] ASSIGN error:", error);

    if (error.name === "CastError") {
      return res
        .status(400)
        .json({ success: false, errors: ["Invalid ID format"] });
    }

    return res
      .status(500)
      .json({ success: false, errors: ["Failed to assign skill"] });
  }
});

/**
 * POST /api/skills/revoke
 * Revoke a skill from an intern (superadmin only).
 * Body: { skillId, internId }
 */
router.post("/revoke", verifyFirebaseUser, requireSuperadmin, async (req, res) => {
  try {
    const { skillId, internId } = req.body;

    // --- Validation ---
    const errors = [];
    if (!skillId) errors.push("Skill ID is required");
    if (!internId) errors.push("Intern ID is required");

    if (errors.length > 0) {
      return res.status(400).json({ success: false, errors });
    }

    // Verify skill exists
    const skill = await Skill.findById(skillId);
    if (!skill) {
      return res
        .status(404)
        .json({ success: false, errors: ["Skill not found"] });
    }

    // Check if the intern has this skill assigned
    const index = skill.assignedTo.indexOf(internId);
    if (index === -1) {
      return res
        .status(404)
        .json({ success: false, errors: ["This skill is not assigned to this intern"] });
    }

    // Remove the intern from assignedTo
    skill.assignedTo.splice(index, 1);
    await skill.save();

    // Return populated skill
    await skill.populate("assignedTo", "name email");

    return res.status(200).json({ success: true, data: skill });
  } catch (error) {
    console.error("[skills] REVOKE error:", error);

    if (error.name === "CastError") {
      return res
        .status(400)
        .json({ success: false, errors: ["Invalid ID format"] });
    }

    return res
      .status(500)
      .json({ success: false, errors: ["Failed to revoke skill"] });
  }
});

module.exports = router;