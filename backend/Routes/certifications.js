const express = require("express");
const router = express.Router();
const Certification = require("../Model/Certification");
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
    console.error("[certifications] requireSuperadmin error:", error);
    return res
      .status(500)
      .json({ success: false, errors: ["Failed to verify admin privileges."] });
  }
}

/**
 * GET /api/certifications
 * Fetch all certifications with user data populated.
 */
router.get("/", verifyFirebaseUser, async (req, res) => {
  try {
    const certifications = await Certification.find({})
      .populate("internId", "name email")
      .sort({ createdAt: -1 });

    return res.status(200).json({ success: true, data: certifications });
  } catch (error) {
    console.error("[certifications] GET error:", error);
    return res
      .status(500)
      .json({ success: false, errors: ["Failed to fetch certifications"] });
  }
});

/**
 * POST /api/certifications
 * Add a new certification (superadmin only).
 * Body: { internId, certificationName, issuingOrganization, issueDate, expirationDate?, credentialId?, credentialUrl? }
 */
router.post("/", verifyFirebaseUser, requireSuperadmin, async (req, res) => {
  try {
    const {
      internId,
      certificationName,
      issuingOrganization,
      issueDate,
      expirationDate,
      credentialId,
      credentialUrl,
    } = req.body;

    // --- Validation ---
    const errors = [];
    if (!internId) errors.push("Intern ID is required");
    if (!certificationName || !certificationName.trim()) errors.push("Certification name is required");
    if (!issuingOrganization || !issuingOrganization.trim()) errors.push("Issuing organization is required");
    if (!issueDate) errors.push("Issue date is required");

    if (errors.length > 0) {
      return res.status(400).json({ success: false, errors });
    }

    // Verify intern exists
    const intern = await User.findById(internId);
    if (!intern) {
      return res
        .status(404)
        .json({ success: false, errors: ["Intern not found"] });
    }

    // Check for duplicate certification for this intern (optional, based on business logic)
    const existing = await Certification.findOne({
      internId,
      certificationName: { $regex: new RegExp(`^${certificationName.trim()}$`, "i") },
      issuingOrganization: { $regex: new RegExp(`^${issuingOrganization.trim()}$`, "i") },
    });
    if (existing) {
      return res
        .status(409)
        .json({ success: false, errors: ["This certification already exists for this intern"] });
    }

    const certification = new Certification({
      internId,
      certificationName: certificationName.trim(),
      issuingOrganization: issuingOrganization.trim(),
      issueDate: new Date(issueDate),
      expirationDate: expirationDate ? new Date(expirationDate) : null,
      credentialId: credentialId ? credentialId.trim() : "",
      credentialUrl: credentialUrl ? credentialUrl.trim() : "",
    });

    await certification.save();

    // Populate intern data for response
    await certification.populate("internId", "name email");

    return res.status(201).json({ success: true, data: certification });
  } catch (error) {
    console.error("[certifications] POST error:", error);

    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((e) => e.message);
      return res.status(400).json({ success: false, errors: messages });
    }

    if (error.code === 11000) {
      return res
        .status(409)
        .json({ success: false, errors: ["A certification with this details already exists"] });
    }

    return res
      .status(500)
      .json({ success: false, errors: ["Failed to create certification"] });
  }
});

/**
 * GET /api/certifications/:id
 * Fetch a specific certification by ID.
 */
router.get("/:id", verifyFirebaseUser, async (req, res) => {
  try {
    const certification = await Certification.findById(req.params.id)
      .populate("internId", "name email");

    if (!certification) {
      return res
        .status(404)
        .json({ success: false, errors: ["Certification not found"] });
    }

    return res.status(200).json({ success: true, data: certification });
  } catch (error) {
    console.error("[certifications] GET/:id error:", error);
    return res
      .status(500)
      .json({ success: false, errors: ["Failed to fetch certification"] });
  }
});

/**
 * PUT /api/certifications/:id
 * Update a certification (superadmin only).
 */
router.put("/:id", verifyFirebaseUser, requireSuperadmin, async (req, res) => {
  try {
    const {
      certificationName,
      issuingOrganization,
      issueDate,
      expirationDate,
      credentialId,
      credentialUrl,
    } = req.body;

    // --- Validation ---
    const errors = [];
    if (!certificationName || !certificationName.trim()) errors.push("Certification name is required");
    if (!issuingOrganization || !issuingOrganization.trim()) errors.push("Issuing organization is required");
    if (!issueDate) errors.push("Issue date is required");

    if (errors.length > 0) {
      return res.status(400).json({ success: false, errors });
    }

    const certification = await Certification.findById(req.params.id);
    if (!certification) {
      return res
        .status(404)
        .json({ success: false, errors: ["Certification not found"] });
    }

    certification.certificationName = certificationName.trim();
    certification.issuingOrganization = issuingOrganization.trim();
    certification.issueDate = new Date(issueDate);
    certification.expirationDate = expirationDate ? new Date(expirationDate) : null;
    certification.credentialId = credentialId ? credentialId.trim() : "";
    certification.credentialUrl = credentialUrl ? credentialUrl.trim() : "";

    await certification.save();

    // Populate intern data for response
    await certification.populate("internId", "name email");

    return res.status(200).json({ success: true, data: certification });
  } catch (error) {
    console.error("[certifications] PUT error:", error);

    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((e) => e.message);
      return res.status(400).json({ success: false, errors: messages });
    }

    return res
      .status(500)
      .json({ success: false, errors: ["Failed to update certification"] });
  }
});

/**
 * DELETE /api/certifications/:id
 * Delete a certification (superadmin only).
 */
router.delete("/:id", verifyFirebaseUser, requireSuperadmin, async (req, res) => {
  try {
    const certification = await Certification.findByIdAndDelete(req.params.id);
    if (!certification) {
      return res
        .status(404)
        .json({ success: false, errors: ["Certification not found"] });
    }

    return res.status(200).json({ success: true, message: "Certification deleted successfully" });
  } catch (error) {
    console.error("[certifications] DELETE error:", error);
    return res
      .status(500)
      .json({ success: false, errors: ["Failed to delete certification"] });
  }
});

module.exports = router;