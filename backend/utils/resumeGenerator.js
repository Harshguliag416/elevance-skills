/**
 * Professional resume HTML generator.
 *
 * Produces a self-contained, print-ready HTML document from the data collected
 * in the Resume Builder form. All user-provided values are HTML-escaped before
 * being interpolated. The generated HTML is stored on the Resume document and
 * rendered by the browser (print → save as PDF for download).
 */

function escapeHtml(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/** Split a newline-separated list into <li> items (blank lines removed). */
function toListItems(value) {
  return String(value || "")
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => `<li>${escapeHtml(s)}</li>`)
    .join("");
}

/**
 * @param {object} data - { name, email, phone, photo, qualifications,
 *   experience, personalInfo, skills }
 * @returns {string} self-contained HTML document.
 */
function generateResumeHtml(data = {}) {
  const name = escapeHtml(data.name || "Your Name");
  const email = escapeHtml(data.email || "");
  const phone = escapeHtml(data.phone || "");
  const qualifications = toListItems(data.qualifications);
  const experience = toListItems(data.experience);
  const personalInfo = escapeHtml(data.personalInfo || "");
  const skills = Array.isArray(data.skills)
    ? data.skills
        .map((s) => escapeHtml(s))
        .filter(Boolean)
        .map((s) => `<span class="skill">${s}</span>`)
        .join("")
    : "";
  const photo = data.photo || "";

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${name} — Resume</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Georgia, 'Times New Roman', serif; color: #1f2937; background: #fff; line-height: 1.5; padding: 40px; }
  .header { display: flex; align-items: center; gap: 24px; border-bottom: 3px solid #1d4ed8; padding-bottom: 20px; margin-bottom: 24px; }
  .header img { width: 96px; height: 96px; border-radius: 50%; object-fit: cover; border: 3px solid #1d4ed8; }
  .header .info { flex: 1; }
  .header h1 { font-size: 30px; letter-spacing: 1px; color: #111827; }
  .header .contact { margin-top: 8px; font-size: 14px; color: #4b5563; }
  .header .contact span { margin-right: 16px; }
  section { margin-bottom: 22px; }
  section h2 { font-size: 16px; text-transform: uppercase; letter-spacing: 2px; color: #1d4ed8; border-bottom: 1px solid #e5e7eb; padding-bottom: 6px; margin-bottom: 10px; }
  ul { list-style: none; padding-left: 2px; }
  li { padding: 3px 0; font-size: 14px; position: relative; padding-left: 16px; }
  li::before { content: "•"; position: absolute; left: 0; color: #1d4ed8; font-weight: bold; }
  .skills { display: flex; flex-wrap: wrap; gap: 8px; }
  .skill { background: #eff6ff; color: #1e40af; border: 1px solid #bfdbfe; border-radius: 999px; padding: 4px 12px; font-size: 13px; }
  p.body { font-size: 14px; color: #374151; }
  @media print { body { padding: 16px; } }
</style>
</head>
<body>
  <div class="header">
    ${photo ? `<img src="${photo}" alt="Photo" />` : ""}
    <div class="info">
      <h1>${name}</h1>
      <div class="contact">
        ${email ? `<span>✉ ${email}</span>` : ""}
        ${phone ? `<span>☎ ${phone}</span>` : ""}
      </div>
    </div>
  </div>

  ${qualifications ? `<section><h2>Qualifications</h2><ul>${qualifications}</ul></section>` : ""}
  ${experience ? `<section><h2>Experience</h2><ul>${experience}</ul></section>` : ""}
  ${skills ? `<section><h2>Skills</h2><div class="skills">${skills}</div></section>` : ""}
  ${personalInfo ? `<section><h2>Personal Information</h2><p class="body">${personalInfo}</p></section>` : ""}
</body>
</html>`;
}

module.exports = { generateResumeHtml };
