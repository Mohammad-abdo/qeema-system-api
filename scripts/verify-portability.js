"use strict";

const path = require("path");
const fs = require("fs");
require("dotenv").config();

const { exportExcel, exportPDF } = require("../src/controllers/dataPortabilityController");

async function runVerification() {
  console.log("=== STARTING WORKSPACE BACKEND VERIFICATION ===");

  // Mock res object for Excel Export
  let excelBuffer = null;
  const mockExcelRes = {
    headers: {},
    setHeader(name, value) {
      this.headers[name] = value;
    },
    send(buf) {
      excelBuffer = buf;
      return this;
    }
  };

  console.log("1. Verifying Excel exportController...");
  await exportExcel({}, mockExcelRes, (err) => {
    if (err) {
      console.error("Excel Export Error Callback:", err);
      process.exit(1);
    }
  });

  if (excelBuffer && mockExcelRes.headers["Content-Type"]) {
    console.log("Excel Export Successful!");
    console.log("- Buffer size:", excelBuffer.length, "bytes");
    console.log("- Content-Type:", mockExcelRes.headers["Content-Type"]);
  } else {
    console.error("Excel Export failed: no buffer returned");
    process.exit(1);
  }

  // Mock res object for PDF Export
  console.log("2. Verifying PDF exportController (projects view)...");
  
  const pdfChunks = [];
  const mockPdfRes = {
    headers: {},
    setHeader(name, value) {
      this.headers[name] = value;
    },
    write(chunk) {
      pdfChunks.push(chunk);
      return true;
    },
    end() {
      const pdfBuffer = Buffer.concat(pdfChunks);
      console.log("PDF Export Successful!");
      console.log("- Buffer size:", pdfBuffer.length, "bytes");
      console.log("- Content-Type:", this.headers["Content-Type"]);
    },
    once() {},
    emit() {},
    on() {},
    removeListener() {}
  };

  await exportPDF({ query: { model: "" } }, mockPdfRes, (err) => {
    if (err) {
      console.error("PDF Export Error Callback:", err);
      process.exit(1);
    }
  });

  console.log("=== WORKSPACE BACKEND VERIFICATION COMPLETE ===");
}

runVerification().catch(e => {
  console.error("Verification failed with exception:", e);
  process.exit(1);
});
