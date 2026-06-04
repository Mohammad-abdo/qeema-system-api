"use strict";

const { exportExcel, exportPDF } = require("../src/controllers/dataPortabilityController");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function runRowReportsVerification() {
  console.log("=== STARTING ROW REPORTS VERIFICATION ===");

  // Fetch sample records from the database
  const project = await prisma.project.findFirst();
  const task = await prisma.task.findFirst();
  const team = await prisma.team.findFirst();
  const user = await prisma.user.findFirst();

  if (!project || !task || !team || !user) {
    console.error("Warning: Missing sample seed records. Run seed script first.");
  }

  const testCases = [
    { model: "projects", id: project?.id || 1 },
    { model: "tasks", id: task?.id || 1 },
    { model: "teams", id: team?.id || 1 },
    { model: "users", id: user?.id || 1 }
  ];

  for (const tc of testCases) {
    console.log(`\n--- Testing Model: ${tc.model}, ID: ${tc.id} ---`);

    // 1. Excel export row
    let excelBuf = null;
    const mockExcelRes = {
      headers: {},
      setHeader(name, value) { this.headers[name] = value; },
      send(buf) { excelBuf = buf; return this; }
    };
    await exportExcel({ query: { model: tc.model, id: String(tc.id) } }, mockExcelRes, (err) => {
      if (err) {
        console.error(`Excel export failed for ${tc.model}:`, err);
        process.exit(1);
      }
    });
    console.log(`- Excel Row Report size: ${excelBuf?.length || 0} bytes`);

    // 2. PDF export row
    const pdfChunks = [];
    const mockPdfRes = {
      headers: {},
      setHeader(name, value) { this.headers[name] = value; },
      write(chunk) { pdfChunks.push(chunk); return true; },
      end() {
        const pdfBuf = Buffer.concat(pdfChunks);
        console.log(`- PDF Row Report size: ${pdfBuf.length} bytes`);
      },
      once() {},
      emit() {},
      on() {},
      removeListener() {}
    };
    await exportPDF({ query: { model: tc.model, id: String(tc.id) } }, mockPdfRes, (err) => {
      if (err) {
        console.error(`PDF export failed for ${tc.model}:`, err);
        process.exit(1);
      }
    });
  }

  console.log("\n=== ROW REPORTS VERIFICATION COMPLETE ===");
  process.exit(0);
}

runRowReportsVerification().catch(e => {
  console.error("Verification crashed:", e);
  process.exit(1);
});
