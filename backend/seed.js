/**
 * Seed script — Professional Certifications
 *
 * Adds 3 sample certifications for existing interns (User documents).
 * Skips silently if no matching interns are found.
 *
 * Usage: node seed.js
 */

require("dotenv").config();
const mongoose = require("mongoose");
const User = require("./Model/User");
const Certification = require("./Model/Certification");

const database = process.env.DATABASE_URL;

// Sample certification data keyed by intern full-name patterns.
// The User collection stores `name` as a full name string (e.g. "Harsh Gulia").
const SAMPLE_CERTIFICATIONS = [
  {
    internNamePattern: /^harsh/i,
    certs: [
      {
        certificationName: "AWS Certified Solutions Architect",
        issuingOrganization: "Amazon Web Services",
        issueDate: new Date("2025-06-15"),
        expirationDate: new Date("2028-06-15"),
        credentialId: "AWS-ASA-987654",
        credentialUrl: "https://aws.amazon.com/verify/987654",
      },
      {
        certificationName: "Google Professional Data Engineer",
        issuingOrganization: "Google Cloud",
        issueDate: new Date("2026-01-20"),
        expirationDate: new Date("2029-01-20"),
        credentialId: "GCP-PDE-123456",
        credentialUrl: "https://google.cloud/credentials/123456",
      },
    ],
  },
  {
    internNamePattern: /^rahul/i,
    certs: [
      {
        certificationName: "Meta Front-End Developer",
        issuingOrganization: "Meta (Coursera)",
        issueDate: new Date("2026-03-01"),
        expirationDate: null,
        credentialId: "",
        credentialUrl: "https://coursera.org/verify/meta-fe-112233",
      },
    ],
  },
];

async function seed() {
  try {
    console.log("Connecting to database...");
    await mongoose.connect(database);
    console.log("Database connected.");

    let totalSeeded = 0;

    for (const entry of SAMPLE_CERTIFICATIONS) {
      // Find interns whose name matches the pattern
      const interns = await User.find({ name: entry.internNamePattern });

      if (interns.length === 0) {
        console.log(
          `  ⚠ No intern found matching pattern "${entry.internNamePattern}". Skipping.`
        );
        continue;
      }

      for (const intern of interns) {
        console.log(
          `  → Seeding certifications for ${intern.name} (${intern._id})`
        );

        for (const certData of entry.certs) {
          const existing = await Certification.findOne({
            internId: intern._id,
            certificationName: certData.certificationName,
          });

          if (existing) {
            console.log(
              `    Already exists: "${certData.certificationName}". Skipping.`
            );
            continue;
          }

          await Certification.create({
            internId: intern._id,
            ...certData,
          });

          console.log(`    Created: "${certData.certificationName}"`);
          totalSeeded++;
        }
      }
    }

    if (totalSeeded === 0) {
      console.log(
        "\nNo certifications were seeded. To add sample data, ensure at least one User document exists whose name matches the patterns in SAMPLE_CERTIFICATIONS."
      );
    } else {
      console.log(`\nDone. ${totalSeeded} certification(s) seeded.`);
    }
  } catch (error) {
    console.error("Seed script failed:", error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log("Database connection closed.");
  }
}

seed();