const express = require("express");
const router = express.Router();
const Certification = require("../Model/Certification");
const { verifyFirebaseUser } = require("../middleware/auth");

/**
 * POST /api/certifications
 * Create a new certification.
 * Required fields: internId, certificationName, issuingOrganization, issueDate.
 * Optional fields: expirationDate, credentialId, credentialUrl.
 */
router.post("/", verifyFirebaseUser, async (req, res) => {
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

    // --- Backend validation for required fields ---
    const errors = [];
    if (!internId) errors.push("Intern is required");
    if (!certificationName || !certificationName.trim())
      errors.push("Certification name is required");
    if (!issuingOrganization || !issuingOrganization.trim())
      errors.push("Issuing organization is required");
    if (!issueDate) errors.push("Issue date is required");
    else if (Number.isNaN(new Date(issueDate).getTime()))
      errors.push("Issue date is not a valid date");

    if (expirationDate && Number.isNaN(new Date(expirationDate).getTime()))
      errors.push("Expiration date is not a valid date");

    if (errors.length > 0) {
      return res.status(400).json({ success: false, errors });
    }

    const certification = new Certification({
      internId,
      certificationName: certificationName.trim(),
      issuingOrganization: issuingOrganization.trim(),
      issueDate,
      expirationDate: expirationDate || null,
      credentialId: credentialId || "",
      credentialUrl: credentialUrl || "",
    });

    await certification.save();

    return res.status(201).json({ success: true, data: certification });
  } catch (error) {
    console.error("[certifications] POST error:", error);

    // Handle invalid ObjectId format for internId
    if (error.name === "CastError") {
      return res
        .status(400)
        .json({ success: false, errors: ["Invalid intern ID format"] });
    }

    // Mongoose validation error
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((e) => e.message);
      return res.status(400).json({ success: false, errors: messages });
    }

    return res
      .status(500)
      .json({ success: false, errors: ["Failed to create certification"] });
  }
});

/**
 * GET /api/certifications/:internId
 * Get all certifications for a specific intern.
 */
router.get("/:internId", verifyFirebaseUser, async (req, res) => {
  try {
    const { internId } = req.params;

    if (!internId) {
      return res
        .status(400)
        .json({ success: false, errors: ["Intern ID is required"] });
    }

    const certifications = await Certification.find({ internId }).sort({
      issueDate: -1,
    });

    return res.status(200).json({ success: true, data: certifications });
  } catch (error) {
    console.error("[certifications] GET error:", error);

    if (error.name === "CastError") {
      return res
        .status(400)
        .json({ success: false, errors: ["Invalid intern ID format"] });
    }

    return res
      .status(500)
      .json({ success: false, errors: ["Failed to fetch certifications"] });
  }
});

/**
 * DELETE /api/certifications/:id
 * Delete a certification by its ID.
 */
router.delete("/:id", verifyFirebaseUser, async (req, res) => {
  try {
    const { id } = req.params;

    const certification = await Certification.findByIdAndDelete(id);

    if (!certification) {
      return res
        .status(404)
        .json({ success: false, errors: ["Certification not found"] });
    }

    return res
      .status(200)
      .json({ success: true, message: "Certification deleted successfully" });
  } catch (error) {
    console.error("[certifications] DELETE error:", error);

    if (error.name === "CastError") {
      return res
        .status(400)
        .json({ success: false, errors: ["Invalid certification ID format"] });
    }

    return res
      .status(500)
      .json({ success: false, errors: ["Failed to delete certification"] });
  }
});

module.exports = router;