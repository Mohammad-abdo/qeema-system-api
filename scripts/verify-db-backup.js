"use strict";

const {
  exportDatabase,
  importDatabase,
  listLocalBackups,
  createLocalBackup,
  restoreLocalBackup,
  deleteLocalBackup
} = require("../src/controllers/dataPortabilityController");

async function verifyBackupController() {
  console.log("=== STARTING BACKEND DATABASE BACKUP CONTROLLER VERIFICATION ===");

  // 1. Mock res for exportDatabase
  let exportJsonString = null;
  const mockExportRes = {
    headers: {},
    setHeader(name, value) {
      this.headers[name] = value;
    },
    send(data) {
      exportJsonString = data;
      return this;
    }
  };

  console.log("1. Verifying exportDatabase...");
  await exportDatabase({}, mockExportRes, (err) => {
    if (err) {
      console.error("Export DB Error:", err);
      process.exit(1);
    }
  });

  if (exportJsonString) {
    const payload = JSON.parse(exportJsonString);
    console.log("- Export Successful!");
    console.log("- Export format:", payload.format);
    console.log("- Export model count:", payload.modelCount);
    console.log("- Export date:", payload.exportedAt);
    if (payload.format !== "prisma-json-backup") {
      console.error("Invalid export format!");
      process.exit(1);
    }
  } else {
    console.error("Export DB failed: no data returned");
    process.exit(1);
  }

  // 2. Verifying listLocalBackups
  console.log("2. Verifying listLocalBackups...");
  let backupsList = null;
  const mockListRes = {
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      backupsList = data;
      return this;
    }
  };

  await listLocalBackups({}, mockListRes, (err) => {
    if (err) {
      console.error("List Backups Error:", err);
      process.exit(1);
    }
  });

  console.log("- List Successful! Count:", backupsList.backups ? backupsList.backups.length : 0);

  // 3. Verifying createLocalBackup
  console.log("3. Verifying createLocalBackup...");
  let createResult = null;
  const mockCreateRes = {
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      createResult = data;
      return this;
    }
  };

  await createLocalBackup({}, mockCreateRes, (err) => {
    if (err) {
      console.error("Create Backup Error:", err);
      process.exit(1);
    }
  });

  if (createResult && createResult.success) {
    console.log("- Create Successful! New file:", createResult.backup.filename);
  } else {
    console.error("Create Backup failed:", createResult);
    process.exit(1);
  }

  // 4. Verifying list again to see if new backup appears
  console.log("4. Listing local backups after creation...");
  await listLocalBackups({}, mockListRes, (err) => {
    if (err) {
      console.error("List Backups Error:", err);
      process.exit(1);
    }
  });
  console.log("- List after create count:", backupsList.backups.length);
  const createdFilename = createResult.backup.filename;
  const found = backupsList.backups.some(b => b.filename === createdFilename);
  if (!found) {
    console.error("Created file not found in list!");
    process.exit(1);
  }

  // 5. Verifying restoreLocalBackup
  console.log("5. Verifying restoreLocalBackup...");
  let restoreResult = null;
  const mockRestoreRes = {
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      restoreResult = data;
      return this;
    }
  };

  await restoreLocalBackup({ params: { filename: createdFilename } }, mockRestoreRes, (err) => {
    if (err) {
      console.error("Restore Backup Error:", err);
      process.exit(1);
    }
  });

  if (restoreResult && restoreResult.success) {
    console.log("- Restore Successful!");
  } else {
    console.error("Restore Backup failed:", restoreResult);
    process.exit(1);
  }

  // 6. Verifying deleteLocalBackup
  console.log("6. Verifying deleteLocalBackup...");
  let deleteResult = null;
  const mockDeleteRes = {
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      deleteResult = data;
      return this;
    }
  };

  await deleteLocalBackup({ params: { filename: createdFilename } }, mockDeleteRes, (err) => {
    if (err) {
      console.error("Delete Backup Error:", err);
      process.exit(1);
    }
  });

  if (deleteResult && deleteResult.success) {
    console.log("- Delete Successful!");
  } else {
    console.error("Delete Backup failed:", deleteResult);
    process.exit(1);
  }

  console.log("=== BACKEND DATABASE BACKUP CONTROLLER VERIFICATION COMPLETE ===");
}

verifyBackupController().catch(e => {
  console.error("Exception during verification:", e);
  process.exit(1);
});
