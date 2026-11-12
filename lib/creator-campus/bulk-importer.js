import * as XLSX from "xlsx";
import { Timestamp } from "firebase-admin/firestore";
import { adminDb } from "../firebase-admin.js";
import {
  REFERRAL_CODE_REGEX,
  reserveReferralCode,
  normalizeUsernamePrefix,
} from "./referral-registry.js";

/**
 * TICKETLELO CREATOR CAMPUS AMBASSADOR PROGRAM
 * Secure CSV/XLSX Bulk Importer with Formula Injection Protection
 */

/**
 * Neutralizes potential CSV formula injection payloads
 */
export function sanitizeCellValue(val) {
  if (val === null || val === undefined) return "";
  const str = String(val).trim();
  if (/^[=+\-@\t\r]/.test(str)) {
    return `'${str}`;
  }
  return str;
}

/**
 * Parse an uploaded CSV or XLSX file buffer into standardized row objects
 */
export function parseImportBuffer(fileBuffer, fileType = "csv") {
  const workbook = XLSX.read(fileBuffer, { type: "buffer", cellDates: true });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) throw new Error("Empty spreadsheet or invalid workbook");

  const sheet = workbook.Sheets[firstSheetName];
  const rawRows = XLSX.utils.sheet_to_json(sheet, { defval: "" });

  return rawRows.map((row, idx) => {
    // Standardize column keys regardless of casing or spacing
    const standardized = {};
    for (const [k, v] of Object.entries(row)) {
      const cleanKey = k.toLowerCase().replace(/[^a-z0-9]/g, "");
      standardized[cleanKey] = sanitizeCellValue(v);
    }

    return {
      rowNumber: idx + 2, // Header is row 1
      name:
        standardized.ambassadorname ||
        standardized.name ||
        standardized.fullname ||
        "",
      username: standardized.username || standardized.user || "",
      email: standardized.email || standardized.emailaddress || "",
      phone: standardized.phone || standardized.whatsappphone || standardized.phonenumber || "",
      referralCode:
        standardized.referralcode || standardized.code || standardized.customcode || "",
      college: standardized.college || standardized.university || "",
    };
  });
}

/**
 * Validates parsed rows and processes bulk import partially
 * (Valid rows are imported; invalid rows are skipped with detailed row/error logs)
 */
export async function processBulkAmbassadorImport({
  fileBuffer,
  fileType = "csv",
  programId,
  organizerId,
  autoApprove = false,
}) {
  if (!adminDb || !programId || !organizerId) {
    throw new Error("Program ID and organizer ID are required.");
  }

  const rows = parseImportBuffer(fileBuffer, fileType);
  if (rows.length === 0) {
    throw new Error("The uploaded file does not contain any data rows.");
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const seenEmailsInFile = new Set();
  const seenCodesInFile = new Set();

  const validRows = [];
  const errors = [];

  // Pass 1: Syntax & Intra-file duplicate validation
  for (const row of rows) {
    const rowNum = row.rowNumber;
    const cleanEmail = row.email.toLowerCase().trim();

    if (!row.name) {
      errors.push({ row: rowNum, field: "name", message: "Ambassador Name is required" });
      continue;
    }
    if (!row.username) {
      errors.push({ row: rowNum, field: "username", message: "Username is required" });
      continue;
    }
    if (!cleanEmail || !emailRegex.test(cleanEmail)) {
      errors.push({ row: rowNum, field: "email", message: "A valid email address is required" });
      continue;
    }

    if (seenEmailsInFile.has(cleanEmail)) {
      errors.push({ row: rowNum, field: "email", message: `Duplicate email inside file (${cleanEmail})` });
      continue;
    }
    seenEmailsInFile.add(cleanEmail);

    if (row.referralCode) {
      const codeUpper = row.referralCode.toUpperCase().trim();
      if (!REFERRAL_CODE_REGEX.test(codeUpper)) {
        errors.push({
          row: rowNum,
          field: "referralCode",
          message: `Referral code "${row.referralCode}" does not match required format XXXX-NNNN`,
        });
        continue;
      }
      if (seenCodesInFile.has(codeUpper)) {
        errors.push({
          row: rowNum,
          field: "referralCode",
          message: `Duplicate referral code inside file (${codeUpper})`,
        });
        continue;
      }
      seenCodesInFile.add(codeUpper);
    }

    validRows.push({
      ...row,
      email: cleanEmail,
    });
  }

  // Pass 2: Process valid rows into Firestore
  let importedCount = 0;

  for (const valid of validRows) {
    try {
      // Check if code or email already exists in system
      if (valid.referralCode) {
        const codeSnap = await adminDb.collection("referralCodes").doc(valid.referralCode.toUpperCase()).get();
        if (codeSnap.exists) {
          errors.push({
            row: valid.rowNumber,
            field: "referralCode",
            message: `Referral code "${valid.referralCode}" is already taken on TicketLelo`,
          });
          continue;
        }
      }

      // Reserve code
      const assignedCode = await reserveReferralCode({
        preferredCode: valid.referralCode || null,
        rawNameOrUsername: valid.username || valid.name,
        email: valid.email,
        programId,
        organizerId,
      });

      // Write application record
      const appRef = adminDb.collection("ambassadorApplications").doc();
      const status = autoApprove ? "approved" : "pending";
      await appRef.set({
        id: appRef.id,
        programId,
        organizerId,
        userId: null,
        fullName: valid.name,
        email: valid.email,
        whatsappPhone: valid.phone,
        college: valid.college,
        referralCode: autoApprove ? assignedCode : null,
        status,
        importedViaBatch: true,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });

      // If auto-approved, initialize programAmbassadors profile immediately
      if (autoApprove) {
        const profileRef = adminDb.collection("programAmbassadors").doc(`${programId}_${appRef.id}`);
        await profileRef.set({
          id: profileRef.id,
          applicationId: appRef.id,
          programId,
          organizerId,
          userId: null,
          fullName: valid.name,
          email: valid.email,
          whatsappPhone: valid.phone,
          college: valid.college,
          referralCode: assignedCode,
          referralLink: `/discover?ref=${assignedCode}`,
          totalPoints: 0,
          referralCount: 0,
          status: "active",
          approvedAt: Timestamp.now(),
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        });
      }

      importedCount++;
    } catch (procErr) {
      errors.push({
        row: valid.rowNumber,
        field: "general",
        message: `Import processing error: ${procErr?.message}`,
      });
    }
  }

  // Record import batch history
  const importRecordRef = adminDb.collection("ambassadorImports").doc();
  await importRecordRef.set({
    id: importRecordRef.id,
    programId,
    organizerId,
    totalRows: rows.length,
    importedCount,
    skippedCount: errors.length,
    errors,
    createdAt: Timestamp.now(),
  });

  return {
    importId: importRecordRef.id,
    totalRows: rows.length,
    importedCount,
    skippedCount: errors.length,
    errors,
  };
}
