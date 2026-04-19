import jsPDF from "jspdf";
import fs from "fs";
import path from "path";

// ==================== CODE 128 BARCODE GENERATOR ====================
const CODE128_START_B = 104;
const CODE128_STOP = 106;

const CODE128_PATTERNS = [
  "11011001100",
  "11001101100",
  "11001100110",
  "10010011000",
  "10010001100",
  "10001001100",
  "10011001000",
  "10011000100",
  "10001100100",
  "11001001000",
  "11001000100",
  "11000100100",
  "10110011100",
  "10011011100",
  "10011001110",
  "10111001100",
  "10011101100",
  "10011100110",
  "11001110010",
  "11001011100",
  "11001001110",
  "11011100100",
  "11001110100",
  "11100101100",
  "11100100110",
  "11101100100",
  "11100110100",
  "11100110010",
  "11011011000",
  "11011000110",
  "11000110110",
  "10100011000",
  "10001011000",
  "10001000110",
  "10110001000",
  "10001101000",
  "10001100010",
  "11010001000",
  "11000101000",
  "11000100010",
  "10110111000",
  "10110001110",
  "10001101110",
  "10111011000",
  "10111000110",
  "10001110110",
  "11101110110",
  "11010001110",
  "11000101110",
  "11011101000",
  "11011100010",
  "11011101110",
  "11101011000",
  "11101000110",
  "11100010110",
  "11101101000",
  "11101100010",
  "11100011010",
  "11101111010",
  "11001000010",
  "11110001010",
  "10100110000",
  "10100001100",
  "10010110000",
  "10010000110",
  "10000101100",
  "10000100110",
  "10110010000",
  "10110000100",
  "10011010000",
  "10011000010",
  "10000110100",
  "10000110010",
  "11000010010",
  "11001010000",
  "11110111010",
  "11000010100",
  "10001111010",
  "10100111100",
  "10010111100",
  "10010011110",
  "10111100100",
  "10011110100",
  "10011110010",
  "11110100100",
  "11110010100",
  "11110010010",
  "11011011110",
  "11110110110",
  "11110011010",
  "10010111000",
  "10010001110",
  "10001010000",
  "10100010000",
  "10100001000",
  "10001010000",
  "10100010000",
  "11101011110",
  "11110101110",
  "11010000100",
  "11010010000",
  "11010011100",
  "1100011101011",
];

function encodeCode128(text) {
  let codes = [CODE128_START_B];
  let checksum = CODE128_START_B;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i) - 32;
    codes.push(code);
    checksum += code * (i + 1);
  }
  codes.push(checksum % 103);
  codes.push(CODE128_STOP);
  let binary = "";
  for (const code of codes) {
    binary += CODE128_PATTERNS[code] || "";
  }
  return binary;
}

function drawBarcode(pdf, text, x, y, width, height) {
  const binary = encodeCode128(text);
  if (!binary) return;
  const barWidth = width / binary.length;
  pdf.setFillColor(0, 0, 0);
  for (let i = 0; i < binary.length; i++) {
    if (binary[i] === "1") {
      pdf.rect(x + i * barWidth, y, barWidth + 0.1, height, "F");
    }
  }
}

// ==================== INTER FONT LOADER ====================
async function loadInterFont(pdf) {
  try {
    const interMediumPath = path.join(
      process.cwd(),
      "public",
      "fonts",
      "Inter_28pt-Medium.ttf",
    );
    if (fs.existsSync(interMediumPath)) {
      const fontBuffer = fs.readFileSync(interMediumPath);
      const fontBase64 = fontBuffer.toString("base64");
      pdf.addFileToVFS("Inter-Medium.ttf", fontBase64);
      pdf.addFont("Inter-Medium.ttf", "Inter", "normal");
    }
    const interBoldPath = path.join(
      process.cwd(),
      "public",
      "fonts",
      "Inter_18pt-Bold.ttf",
    );
    if (fs.existsSync(interBoldPath)) {
      const fontBuffer = fs.readFileSync(interBoldPath);
      const fontBase64 = fontBuffer.toString("base64");
      pdf.addFileToVFS("Inter-Bold.ttf", fontBase64);
      pdf.addFont("Inter-Bold.ttf", "Inter", "bold");
    }
    return true;
  } catch (error) {
    console.warn(
      "Inter font not found, falling back to helvetica:",
      error.message,
    );
    return false;
  }
}

// ==================== HELPERS ====================
function getFont(hasInter) {
  return hasInter ? "Inter" : "helvetica";
}

function loadImage(relativePath) {
  try {
    const fullPath = path.join(process.cwd(), relativePath);
    const buffer = fs.readFileSync(fullPath);
    return `data:image/png;base64,${buffer.toString("base64")}`;
  } catch (error) {
    console.warn(`Failed to load image ${relativePath}:`, error.message);
    return null;
  }
}

function formatTime12(date) {
  if (!date || isNaN(date)) return "12:00 PM";
  const hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  return `${hours % 12 || 12}:${minutes} ${ampm}`;
}

function formatTime24(date) {
  if (!date || isNaN(date)) return "13:00";
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function parseEventDate(eventDate) {
  if (!eventDate) return null;
  const d =
    typeof eventDate.toDate === "function"
      ? eventDate.toDate()
      : new Date(eventDate);
  return isNaN(d) ? null : d;
}

// ==================== MAIN EXPORT ====================
export const generatePDFTicket = async (registration, event, qrCode) => {
  const pdf = new jsPDF("landscape", "mm", [297, 105]);
  const W = pdf.internal.pageSize.getWidth();
  const H = pdf.internal.pageSize.getHeight();

  const hasInter = await loadInterFont(pdf);
  const emailLogoBase64 = loadImage("public/email_logo.png");
  const ticketLogoBase64 = loadImage("public/ticket.png");

  drawPage1(pdf, W, H, registration, event, qrCode, ticketLogoBase64, hasInter);

  pdf.addPage();
  drawPage2(
    pdf,
    W,
    H,
    registration,
    event,
    emailLogoBase64,
    ticketLogoBase64,
    hasInter,
  );

  return pdf.output("blob");
};

// ==================== PAGE 1: FRONT ====================
function drawPage1(
  pdf,
  W,
  H,
  registration,
  event,
  qrCode,
  ticketLogoBase64,
  hasInter,
) {
  const font = getFont(hasInter);
  const eventDate = parseEventDate(event?.date);

  // White background
  pdf.setFillColor(255, 255, 255);
  pdf.rect(0, 0, W, H, "F");

  // Border
  pdf.setDrawColor(0, 0, 0);
  pdf.setLineWidth(0.8);
  pdf.roundedRect(8, 8, W - 16, H - 16, 4, 4);

  // Side notches
  const notchR = 8;
  const midY = H / 2;
  pdf.setFillColor(255, 255, 255);
  pdf.setDrawColor(0, 0, 0);
  pdf.setLineWidth(0.8);
  pdf.circle(8, midY, notchR, "FD");
  pdf.circle(W - 8, midY, notchR, "FD");

  // Perforated divider
  const divX = 100;
  pdf.setDrawColor(180, 180, 180);
  pdf.setLineDash([2, 2]);
  pdf.line(divX, 12, divX, midY - notchR - 2);
  pdf.line(divX, midY + notchR + 2, divX, H - 12);
  pdf.setLineDash([]);

  // ===== LEFT SIDE =====
  const lm = 22;

  // Event name label (actual event name) — centered above QR
  const eventNameLabel = (event?.name || "EVENT NAME").toUpperCase();
  const qrCenterX = lm + 26; // center of 52mm wide QR
  pdf.setFontSize(7.5);
  pdf.setFont(font, "bold");
  pdf.setTextColor(0, 0, 0);
  const labelLines = pdf.splitTextToSize(eventNameLabel, 56);
  labelLines.slice(0, 2).forEach((line, i) => {
    pdf.text(line, qrCenterX, 19 + i * 5, { align: "center" });
  });

  // QR Code
  if (qrCode) {
    pdf.addImage(qrCode, "PNG", lm, 22, 52, 52);
  }

  // TICKET NO. + value
  pdf.setFontSize(8);
  pdf.setFont(font, "bold");
  pdf.setTextColor(0, 0, 0);
  pdf.text("TICKET NO.", lm, 82);

  const ticketId = (registration?.ticketId || "").slice(-10);
  pdf.setFontSize(10);
  pdf.setFont(font, "bold");
  pdf.setTextColor(0, 0, 0);
  pdf.text(ticketId, lm + 26, 82);

  // TIME + value
  pdf.setFontSize(8);
  pdf.setFont(font, "bold");
  pdf.setTextColor(0, 0, 0);
  pdf.text("TIME", lm, 91);

  pdf.setFontSize(10);
  pdf.setFont(font, "bold");
  pdf.setTextColor(0, 0, 0);
  pdf.text(formatTime12(eventDate), lm + 14, 91);

  // ===== RIGHT SIDE =====
  const rs = divX + 10;

  // Event Name (large bold uppercase)
  const eventName = (event?.name || "EVENT NAME").toUpperCase();
  pdf.setFontSize(22);
  pdf.setFont(font, "bold");
  pdf.setTextColor(0, 0, 0);
  const nameLines = pdf.splitTextToSize(eventName, W - rs - 70);
  nameLines.slice(0, 2).forEach((line, i) => {
    pdf.text(line, rs, 26 + i * 9);
  });

  // Date top-right (MM-DD-YY)
  let dateStr = "01-05-26";
  let yearStr = "2026";
  if (eventDate) {
    const dd = String(eventDate.getDate()).padStart(2, "0");
    const mm = String(eventDate.getMonth() + 1).padStart(2, "0");
    const yyyy = String(eventDate.getFullYear());
    dateStr = `${mm}-${dd}-${yyyy.substring(2)}`;
    yearStr = yyyy;
  }
  pdf.setFontSize(16);
  pdf.setFont(font, "bold");
  pdf.text(dateStr, W - 18, 24, { align: "right" });
  pdf.setFontSize(13);
  pdf.text(yearStr, W - 18, 33, { align: "right" });

  // ===== DETAILS GRID =====
  const col1 = rs;
  const col2 = rs + 55;
  const col3 = rs + 115;
  let dy = 50;

  // Row 1 Headers
  pdf.setFontSize(6.5);
  pdf.setFont(font, "bold");
  pdf.setTextColor(0, 0, 0);
  pdf.text("OPENING TIME", col1, dy);
  pdf.text("DESTINATION", col2, dy);
  pdf.text("TICKET TYPE", col3, dy);
  pdf.text("PRICE OF THE TICKET", col3 + 28, dy);

  // Row 1 Values
  pdf.setFontSize(11);
  pdf.setFont(font, "bold");
  pdf.setTextColor(0, 0, 0);
  pdf.text(formatTime24(eventDate), col1, dy + 6);

  const location = (event?.location || "IIT DELHI").toUpperCase();
  const locLines = pdf.splitTextToSize(location, 50);
  pdf.setFontSize(10);
  locLines.slice(0, 2).forEach((line, i) => {
    pdf.text(line, col2, dy + 6 + i * 4);
  });

  pdf.setFontSize(11);
  pdf.text("ADULT", col3, dy + 6);

  const price = registration?.amount ? `${registration.amount}` : "0001";
  pdf.text(price, col3 + 28, dy + 6);

  // Row 2
  dy += 18;
  pdf.setFontSize(6.5);
  pdf.setFont(font, "bold");
  pdf.setTextColor(0, 0, 0);
  pdf.text("CLOSING TIME", col1, dy);
  pdf.text("LOCATION ADDRESS", col2, dy - 5);
  pdf.text("ZIP CODE 122345", col2, dy);
  pdf.text("SEAT TYPE/NO", col3, dy);

  // Row 2 Values
  pdf.setFontSize(11);
  pdf.setFont(font, "bold");
  pdf.setTextColor(0, 0, 0);

  let closingTime = "13:00";
  if (eventDate) {
    const ct = new Date(eventDate);
    ct.setHours(ct.getHours() + 3);
    closingTime = formatTime24(ct);
  }
  pdf.text(closingTime, col1, dy + 6);
  pdf.text("0001", col3, dy + 6);

  // Ticket icon bottom right
  if (ticketLogoBase64) {
    pdf.addImage(ticketLogoBase64, "PNG", W - 30, H - 22, 18, 12);
  }
}

// ==================== PAGE 2: BACK ====================
function drawPage2(
  pdf,
  W,
  H,
  registration,
  event,
  emailLogoBase64,
  ticketLogoBase64,
  hasInter,
) {
  const font = getFont(hasInter);
  const ticketId = (registration?.ticketId || "").slice(-10);

  // White background
  pdf.setFillColor(255, 255, 255);
  pdf.rect(0, 0, W, H, "F");

  // Border
  pdf.setDrawColor(0, 0, 0);
  pdf.setLineWidth(0.8);
  pdf.roundedRect(8, 8, W - 16, H - 16, 4, 4);

  // Side notches
  const notchR = 8;
  const midY = H / 2;
  pdf.setFillColor(255, 255, 255);
  pdf.setDrawColor(0, 0, 0);
  pdf.setLineWidth(0.8);
  pdf.circle(8, midY, notchR, "FD");
  pdf.circle(W - 8, midY, notchR, "FD");

  // Perforated divider
  const divX = 100;
  pdf.setDrawColor(180, 180, 180);
  pdf.setLineDash([2, 2]);
  pdf.line(divX, 12, divX, midY - notchR - 2);
  pdf.line(divX, midY + notchR + 2, divX, H - 12);
  pdf.setLineDash([]);

  // ===== LEFT SIDE =====
  const lm = 18;

  // Email logo — large, fills the left top area
  if (emailLogoBase64) {
    pdf.addImage(emailLogoBase64, "PNG", lm, 13, 72, 30);
  }

  // ===== BARCODE (scannable Code 128) =====
  const barcodeY = 46;
  const barcodeText = ticketId || "1234567890";
  drawBarcode(pdf, barcodeText, lm, barcodeY, 75, 24);

  // TICKET NO. below barcode
  pdf.setFontSize(7);
  pdf.setFont(font, "normal");
  pdf.setTextColor(0, 0, 0);
  pdf.text("TICKET NO.", lm, barcodeY + 30);

  pdf.setFontSize(9);
  pdf.setFont(font, "bold");
  pdf.text(ticketId, lm + 22, barcodeY + 30);

  // ===== RIGHT SIDE: TWO-COLUMN TEXT =====
  const rs = divX + 8;
  const totalRightWidth = W - rs - 16;
  const colW = (totalRightWidth - 6) / 2;
  const c1x = rs;
  const c2x = rs + colW + 6;
  const topY = 13;
  const bottomY = H - 16;
  const availableHeight = bottomY - topY - 4;

  const col1Text =
    "MOST TICKETING PLATFORMS TREAT ORGANIZERS LIKE USERS. TICKETLELO TREATS THEM LIKE OPERATORS. IT'S BUILT FOR PEOPLE WHO DON'T JUST HOST EVENTS, BUT RUN THEM AT SCALE.\n\nFROM LAUNCHING FULLY BRANDED TICKETING PAGES IN MINUTES TO MANAGING MULTIPLE EVENTS, TEAMS, AND PRICING MODELS FROM A SINGLE SYSTEM, TICKETLELO REMOVES FRICTION WHERE IT ACTUALLY MATTERS. NO RIGID STRUCTURES. NO UNNECESSARY COMMISSIONS. JUST COMPLETE CONTROL OVER HOW TICKETS ARE CREATED, SOLD, AND EXPERIENCED.";

  const col2Text =
    "AT ITS CORE, TICKETLELO IS AN OPERATING LAYER FOR EVENT BUSINESSES IN INDIA.\n\nWHETHER IT'S COLLEGE FESTS, COMMUNITY EVENTS, OR LARGE-SCALE PRODUCTIONS, IT GIVES ORGANIZERS THE FLEXIBILITY TO ADAPT FAST — DYNAMIC PRICING, CUSTOM ACCESS CONTROL, AND SEAMLESS ATTENDEE MANAGEMENT.\n\nIT'S NOT TRYING TO BE ANOTHER MARKETPLACE. IT'S INFRASTRUCTURE. THE KIND THAT LETS YOU MOVE FASTER, LOOK MORE PROFESSIONAL, AND OWN YOUR ENTIRE EVENT ECOSYSTEM WITHOUT DEPENDING ON ANYONE ELSE.";

  // Auto-fit font size to fill the available height
  let fontSize = 7.5;
  let lineH = fontSize * 0.55;
  let lines1, lines2, totalLines;
  while (fontSize >= 4.5) {
    lineH = fontSize * 0.55;
    lines1 = pdf.splitTextToSize(col1Text, colW - 2);
    lines2 = pdf.splitTextToSize(col2Text, colW - 2);
    totalLines = Math.max(lines1.length, lines2.length);
    if (totalLines * lineH <= availableHeight) break;
    fontSize -= 0.25;
    pdf.setFontSize(fontSize);
  }

  // Column 1
  pdf.setFont(font, "normal");
  pdf.setFontSize(fontSize);
  pdf.setTextColor(0, 0, 0);
  lines1 = pdf.splitTextToSize(col1Text, colW - 2);
  let y1 = topY + 4;
  lines1.forEach((line) => {
    if (y1 < bottomY) {
      pdf.text(line, c1x, y1);
      y1 += lineH;
    }
  });

  // Column 2
  pdf.setFont(font, "normal");
  pdf.setFontSize(fontSize);
  pdf.setTextColor(0, 0, 0);
  lines2 = pdf.splitTextToSize(col2Text, colW - 2);
  let y2 = topY + 4;
  lines2.forEach((line) => {
    if (y2 < bottomY) {
      pdf.text(line, c2x, y2);
      y2 += lineH;
    }
  });

  // Ticket icon bottom right
  if (ticketLogoBase64) {
    pdf.addImage(ticketLogoBase64, "PNG", W - 30, H - 22, 18, 12);
  }
}
