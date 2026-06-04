"use strict";

const path = require("path");
const fs = require("fs");
require("dotenv").config();

const { exportExcel, importExcel } = require("../src/controllers/dataPortabilityController");

async function runImportVerification() {
  console.log("=== STARTING IMPORT ROUND-TRIP VERIFICATION ===");

  // 1. Export Excel
  let excelBuffer = null;
  const mockExcelRes = {
    headers: {},
    setHeader(name, value) {},
    send(buf) {
      excelBuffer = buf;
      return this;
    }
  };

  await exportExcel({}, mockExcelRes, (err) => {
    if (err) {
      console.error("Export Failed:", err);
      process.exit(1);
    }
  });

  if (!excelBuffer) {
    console.error("Export failed: did not receive Excel buffer.");
    process.exit(1);
  }
  console.log("Exported workbook size:", excelBuffer.length, "bytes");

  // 2. Mock Import Request
  const mockReq = {
    file: {
      buffer: excelBuffer
    }
  };

  let jsonResult = null;
  const mockRes = {
    statusCode: 200,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      jsonResult = data;
      return this;
    }
  };

  console.log("Running Excel Import...");
  await importExcel(mockReq, mockRes, (err) => {
    if (err) {
      console.error("Import Failed with error callback:", err);
      process.exit(1);
    }
  });

  console.log("Response status:", mockRes.statusCode);
  if (jsonResult) {
    console.log("Import result payload:", JSON.stringify(jsonResult, null, 2));
    if (jsonResult.success) {
      console.log("Import round-trip verified successfully!");
    } else {
      console.error("Import returned failure status:", jsonResult.error);
      process.exit(1);
    }
  } else {
    console.error("Import failed: no response payload received");
    process.exit(1);
  }

  console.log("=== IMPORT VERIFICATION COMPLETE ===");
}

runImportVerification().catch(e => {
  console.error("Import verification crashed:", e);
  process.exit(1);
});
