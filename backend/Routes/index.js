const express = require("express");
const router = express.Router();
const admin = require("./admin");
const intern = require("./internship");
const job = require("./job");
const application = require("./application");
const user = require("./user");
const certification = require("./certification");
const skills = require("./skills");
const internList = require("./intern");

router.use("/admin", admin);
router.use("/internship", intern);
router.use("/job", job);
router.use("/application", application);
router.use("/user", user);
router.use("/certifications", certification);
router.use("/skills", skills);
router.use("/interns", internList);

module.exports = router;
