"use strict";

const { exportExcel } = require("../src/controllers/dataPortabilityController");
const xlsx = require("xlsx");

async function inspect() {
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

  // Call exportExcel with model=projects
  await exportExcel({ query: { model: "projects" } }, mockExcelRes, (err) => {
    if (err) {
      console.error("Export Failed:", err);
      process.exit(1);
    }
  });

  if (!excelBuffer) {
    console.error("Failed to generate Excel buffer.");
    return;
  }

  const workbook = xlsx.read(excelBuffer, { type: "buffer" });
  console.log("Sheet names in workbook:", workbook.SheetNames);
}

inspect().catch(console.error);
