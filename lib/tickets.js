import jsPdfModule from "jspdf";
const jsPDF = jsPdfModule.jsPDF || jsPdfModule;
import fs from "fs";
import path from "path";
import QRCode from "qrcode";

// ==================== CODE 128 BARCODE GENERATOR ====================
const CODE128_START_B = 104;
const CODE128_STOP = 106;

const CODE128_PATTERNS = [
  "11011001100", "11001101100", "11001100110", "10010011000", "10010001100", "10001001100",
  "10011001000", "10011000100", "10001100100", "11001001000", "11001000100", "11000100100",
  "10110011100", "10011011100", "10011001110", "10111001100", "10011101100", "10011100110",
  "11001110010", "11001011100", "11001001110", "11011100100", "11001110100", "11100101100",
  "11100100110", "11101100100", "11100110100", "11100110010", "11011011000", "11011000110",
  "11000110110", "10100011000", "10001011000", "10001000110", "10110001000", "10001101000",
  "10001100010", "11010001000", "11000101000", "11000100010", "10110111000", "10110001110",
  "10001101110", "10111011000", "10111000110", "10001110110", "11101110110", "11010001110",
  "11000101110", "11011101000", "11011100010", "11011101110", "11101011000", "11101000110",
  "11100010110", "11101101000", "11101100010", "11100011010", "11101111010", "11001000010",
  "11110001010", "10100110000", "10100001100", "10010110000", "10010000110", "10000101100",
  "10000100110", "10110010000", "10110000100", "10011010000", "10011000010", "10000110100",
  "10000110010", "11000010010", "11001010000", "11110111010", "11000010100", "10001111010",
  "10100111100", "10010111100", "10010011110", "10111100100", "10011110100", "10011110010",
  "11110100100", "11110010100", "11110010010", "11011011110", "11110110110", "11110011010",
  "10010111000", "10010001110", "10001010000", "10100010000", "10100001000", "10001010000",
  "10100010000", "11101011110", "11110101110", "11010000100", "11010010000", "11010011100",
  "1100011101011",
];

function encodeCode128(text = "") {
  const safeText = String(text || "1234567890");
  let codes = [CODE128_START_B];
  let checksum = CODE128_START_B;
  for (let i = 0; i < safeText.length; i++) {
    const code = safeText.charCodeAt(i) - 32;
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

function drawVerticalBarcode(pdf, text, x, y, width, height) {
  const binary = encodeCode128(text);
  if (!binary) return;
  const barHeight = height / binary.length;
  pdf.setFillColor(0, 0, 0);
  for (let i = 0; i < binary.length; i++) {
    if (binary[i] === "1") {
      pdf.rect(x, y + i * barHeight, width, barHeight + 0.1, "F");
    }
  }
}

// ==================== FONT & IMAGE LOADERS ====================
async function loadInterFont(pdf) {
  try {
    const interMediumPath = path.join(process.cwd(), "public", "fonts", "Inter_28pt-Medium.ttf");
    if (fs.existsSync(interMediumPath)) {
      const fontBuffer = fs.readFileSync(interMediumPath);
      pdf.addFileToVFS("Inter-Medium.ttf", fontBuffer.toString("base64"));
      pdf.addFont("Inter-Medium.ttf", "Inter", "normal");
    }
    const interBoldPath = path.join(process.cwd(), "public", "fonts", "Inter_18pt-Bold.ttf");
    if (fs.existsSync(interBoldPath)) {
      const fontBuffer = fs.readFileSync(interBoldPath);
      pdf.addFileToVFS("Inter-Bold.ttf", fontBuffer.toString("base64"));
      pdf.addFont("Inter-Bold.ttf", "Inter", "bold");
    }
    return true;
  } catch {
    return false;
  }
}

function getFont(hasInter) {
  return hasInter ? "Inter" : "helvetica";
}

function loadImage(relativePath) {
  try {
    const fullPath = path.join(process.cwd(), relativePath);
    if (!fs.existsSync(fullPath)) return null;
    const buffer = fs.readFileSync(fullPath);
    return `data:image/png;base64,${buffer.toString("base64")}`;
  } catch {
    return null;
  }
}

function parseEventDate(eventDate) {
  if (!eventDate) return new Date();
  const d = typeof eventDate.toDate === "function"
    ? eventDate.toDate()
    : new Date(eventDate);
  return isNaN(d) ? new Date() : d;
}

function getThemePalette(themeName = "") {
  const t = String(themeName || "").toLowerCase();
  if (t.includes("game") || t.includes("gaming") || t.includes("praroha")) {
    return {
      name: "gaming",
      artRgb: [71, 47, 146], // #472F92
      stubRgb: [21, 13, 41], // #150D29
      titleRgb: [255, 255, 255],
      scanRgb: [61, 214, 140], // #3DD68C
      accentRgb: [253, 224, 3], // #FDE003
    };
  }
  if (t.includes("mic") || t.includes("open") || t.includes("cult") || t.includes("music")) {
    return {
      name: "mic",
      artRgb: [222, 51, 76], // #DE334C
      stubRgb: [29, 6, 13], // #1D060D
      titleRgb: [255, 255, 255],
      scanRgb: [254, 118, 11], // #FE760B
      accentRgb: [253, 224, 3], // #FDE003
    };
  }
  if (t.includes("robot") || t.includes("expo") || t.includes("science")) {
    return {
      name: "robotics",
      artRgb: [14, 116, 109], // #0E746D
      stubRgb: [5, 25, 23], // #051917
      titleRgb: [255, 255, 255],
      scanRgb: [253, 224, 3], // #FDE003
      accentRgb: [61, 214, 140],
    };
  }
  // Default Tech Fest Orange
  return {
    name: "tech",
    artRgb: [254, 118, 11], // #FE760B
    stubRgb: [32, 18, 7], // #201207
    titleRgb: [0, 0, 0],
    scanRgb: [253, 224, 3], // #FDE003
    accentRgb: [253, 224, 3],
  };
}

// ==================== MAIN EXPORT ====================
export const generatePDFTicket = async (registration = {}, event = {}, qrCodeInput = "") => {
  const pdf = new jsPDF("landscape", "mm", [297, 105]);
  const W = pdf.internal.pageSize.getWidth();
  const H = pdf.internal.pageSize.getHeight();

  const hasInter = await loadInterFont(pdf);
  const emailLogoBase64 = loadImage("public/email_logo.png");
  const ticketLogoBase64 = loadImage("public/ticket.png");

  // Ensure QR Code is data URL
  let qrCodeDataUrl = qrCodeInput || registration.qrCode || "";
  if (!qrCodeDataUrl || !qrCodeDataUrl.startsWith("data:image")) {
    try {
      const payload =
        qrCodeInput ||
        registration.qrPayload ||
        registration.ticketId ||
        "TICKETLELO-PASS";
      qrCodeDataUrl = await QRCode.toDataURL(payload, {
        margin: 1,
        width: 240,
        color: { dark: "#000000", light: "#FFFFFF" },
      });
    } catch {
      qrCodeDataUrl = "";
    }
  }

  const isWide = event?.ticketDesign === "wide";

  if (isWide) {
    drawWideTicketPDF(pdf, W, H, registration, event, qrCodeDataUrl, ticketLogoBase64, hasInter);
  } else {
    drawStubTicketPDF(pdf, W, H, registration, event, qrCodeDataUrl, ticketLogoBase64, hasInter);
  }

  // Page 2: Official Terms & Entry Check-in Details
  pdf.addPage();
  drawPage2(pdf, W, H, registration, event, emailLogoBase64, ticketLogoBase64, hasInter);

  return pdf.output("blob");
};

// ==================== STUB TICKET PDF (IMAGE 1 EXACT MATCH) ====================
function drawStubTicketPDF(pdf, W, H, registration, event, qrCode, ticketLogoBase64, hasInter) {
  const font = getFont(hasInter);
  const palette = getThemePalette(event?.theme || event?.name || event?.category);
  const eventDate = parseEventDate(event?.date);

  // Background white page
  pdf.setFillColor(255, 255, 255);
  pdf.rect(0, 0, W, H, "F");

  // Ticket card bounds
  const cardX = 14;
  const cardY = 12;
  const cardW = 269;
  const cardH = 81;
  const notchX = 202; // dividing line position
  const notchR = 4;

  // 1. LEFT ART PANEL
  pdf.setFillColor(...palette.artRgb);
  pdf.roundedRect(cardX, cardY, notchX - cardX, cardH, 3, 3, "F");

  // Bottom info strip (dark bar)
  pdf.setFillColor(12, 13, 16);
  pdf.rect(cardX, cardY + cardH - 11, notchX - cardX, 11, "F");

  // Event Name & Year in Art Panel
  const eventName = (event?.name || event?.title || "EVENT PASS").toUpperCase();
  const words = eventName.split(/\s+/);
  let line1 = eventName;
  let line2 = "2026";

  if (words.length >= 2) {
    const lastWord = words[words.length - 1];
    if (/^\d{4}$/.test(lastWord)) {
      line1 = words.slice(0, words.length - 1).join(" ");
      line2 = lastWord;
    } else {
      line1 = words.slice(0, words.length - 1).join(" ");
      line2 = lastWord;
    }
  }

  // Headline 1
  pdf.setFont(font, "bold");
  pdf.setFontSize(28);
  pdf.setTextColor(...palette.titleRgb);
  pdf.text(line1, cardX + 8, cardY + 28);

  // Headline 2
  pdf.setFont(font, "bold");
  pdf.setFontSize(24);
  pdf.text(line2, cardX + 8, cardY + 45);

  // Bottom strip text
  const days = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
  const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
  const dStr = `${days[eventDate.getDay()]} ${String(eventDate.getDate()).padStart(2, "0")} ${months[eventDate.getMonth()]} ${eventDate.getFullYear()}`;
  const tStr = event?.time || "12:00 PM";
  const vStr = (event?.location || event?.venue || "MAIN AUDITORIUM").toUpperCase();
  const tierStr = (registration?.ticketTier || registration?.tierName || "GENERAL").toUpperCase();
  const priceStr = registration?.amount !== undefined ? (registration.amount === 0 ? "FREE ENTRY" : `INR ${registration.amount}`) : "FREE ENTRY";

  const stripText = `${dStr} • ${tStr} • ${vStr} • ${tierStr} • ${priceStr}`;
  pdf.setFont(font, "bold");
  pdf.setFontSize(7.5);
  pdf.setTextColor(208, 208, 209);
  pdf.text(stripText, cardX + 8, cardY + cardH - 4);

  // 2. RIGHT STUB (Dark QR Stub)
  pdf.setFillColor(...palette.stubRgb);
  pdf.roundedRect(notchX, cardY, cardX + cardW - notchX, cardH, 3, 3, "F");

  // "SCAN AT ENTRY" header
  pdf.setFont(font, "bold");
  pdf.setFontSize(9);
  pdf.setTextColor(...palette.scanRgb);
  pdf.text("SCAN AT ENTRY", notchX + (cardX + cardW - notchX) / 2, cardY + 8.5, { align: "center" });

  // QR Code
  if (qrCode) {
    const qrW = 39;
    const qrH = 39;
    const qrX = notchX + (cardX + cardW - notchX - qrW) / 2;
    const qrY = cardY + 12;
    pdf.addImage(qrCode, "PNG", qrX, qrY, qrW, qrH);
  }

  // Ticket ID
  const ticketId = registration?.ticketId || registration?.id || "TKT-1793-AB12C";
  pdf.setFont(font, "bold");
  pdf.setFontSize(8.5);
  pdf.setTextColor(254, 118, 11);
  pdf.text(ticketId, notchX + (cardX + cardW - notchX) / 2, cardY + 60, { align: "center" });

  // Attendee Name
  const attendee = registration?.fullName || registration?.attendeeName || registration?.buyerName || "Attendee";
  pdf.setFont(font, "normal");
  pdf.setFontSize(8);
  pdf.setTextColor(208, 208, 209);
  pdf.text(attendee, notchX + (cardX + cardW - notchX) / 2, cardY + 68, { align: "center" });

  // Die-cut semicircular notches between panels
  pdf.setFillColor(255, 255, 255);
  pdf.circle(notchX, cardY, notchR, "F");
  pdf.circle(notchX, cardY + cardH, notchR, "F");

  // Perforated line between notches
  pdf.setDrawColor(0, 0, 0);
  pdf.setLineDash([1.5, 1.5]);
  pdf.line(notchX, cardY + notchR, notchX, cardY + cardH - notchR);
  pdf.setLineDash([]);
}

// ==================== WIDE TICKET PDF (IMAGE 2 EXACT MATCH) ====================
function drawWideTicketPDF(pdf, W, H, registration, event, qrCode, ticketLogoBase64, hasInter) {
  const font = getFont(hasInter);
  const palette = getThemePalette(event?.theme || event?.name || event?.category);
  const eventDate = parseEventDate(event?.date);

  // Background white page
  pdf.setFillColor(255, 255, 255);
  pdf.rect(0, 0, W, H, "F");

  // Ticket dimensions
  const cardX = 14;
  const cardY = 14;
  const cardW = 269;
  const cardH = 77;
  const div1X = cardX + 58; // between left & center
  const div2X = cardX + cardW - 46; // between center & right
  const notchR = 3.5;

  // 1. LEFT PANEL (White with ADMIT ONE, QR, Ticket ID)
  pdf.setFillColor(255, 255, 255);
  pdf.setDrawColor(200, 200, 200);
  pdf.setLineWidth(0.4);
  pdf.roundedRect(cardX, cardY, div1X - cardX, cardH, 3, 3, "FD");

  pdf.setFont(font, "bold");
  pdf.setFontSize(8.5);
  pdf.setTextColor(0, 0, 0);
  pdf.text("ADMIT ONE", cardX + (div1X - cardX) / 2, cardY + 9, { align: "center" });

  if (qrCode) {
    const qrSize = 34;
    const qX = cardX + (div1X - cardX - qrSize) / 2;
    pdf.addImage(qrCode, "PNG", qX, cardY + 14, qrSize, qrSize);
  }

  const ticketId = registration?.ticketId || registration?.id || "TKT-1793-AB12C";
  pdf.setFont(font, "bold");
  pdf.setFontSize(8);
  pdf.setTextColor(0, 0, 0);
  pdf.text(ticketId, cardX + (div1X - cardX) / 2, cardY + 60, { align: "center" });

  // 2. CENTER PANEL (Vibrant Art Panel)
  pdf.setFillColor(...palette.artRgb);
  pdf.rect(div1X, cardY, div2X - div1X, cardH, "F");

  // Headline
  const eventName = (event?.name || event?.title || "TECH FEST 2026").toUpperCase();
  const words = eventName.split(/\s+/);
  let line1 = eventName;
  let line2 = "2026";
  if (words.length >= 2) {
    const lastWord = words[words.length - 1];
    line1 = words.slice(0, words.length - 1).join(" ");
    line2 = lastWord;
  }

  pdf.setFont(font, "bold");
  pdf.setFontSize(26);
  pdf.setTextColor(...palette.titleRgb);
  pdf.text(line1, div1X + 8, cardY + 28);

  pdf.setFont(font, "bold");
  pdf.setFontSize(22);
  pdf.text(line2, div1X + 8, cardY + 44);

  // Bottom strip inside art panel
  const days = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
  const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
  const dStr = `${days[eventDate.getDay()]} ${String(eventDate.getDate()).padStart(2, "0")} ${months[eventDate.getMonth()]} ${eventDate.getFullYear()}`;
  const tStr = event?.time || "12:00 PM";
  const vStr = (event?.location || event?.venue || "MAIN AUDITORIUM").toUpperCase();
  const attendee = (registration?.fullName || registration?.attendeeName || registration?.buyerName || "AARAV KUMAR").toUpperCase();

  const stripText = `${dStr} • ${tStr} • ${vStr} • ${attendee}`;
  pdf.setFont(font, "bold");
  pdf.setFontSize(8);
  pdf.setTextColor(0, 0, 0);
  pdf.text(stripText, div1X + 8, cardY + cardH - 6);

  // 3. RIGHT PANEL (White Barcode Stub)
  pdf.setFillColor(255, 255, 255);
  pdf.setDrawColor(200, 200, 200);
  pdf.setLineWidth(0.4);
  pdf.roundedRect(div2X, cardY, cardX + cardW - div2X, cardH, 3, 3, "FD");

  // Vertical Barcode
  const bcW = 16;
  const bcH = 46;
  const bcX = div2X + (cardX + cardW - div2X - bcW) / 2 + 5;
  const bcY = cardY + (cardH - bcH) / 2;
  drawVerticalBarcode(pdf, ticketId, bcX, bcY, bcW, bcH);

  // Vertical Ticket ID text
  pdf.setFont(font, "bold");
  pdf.setFontSize(7.5);
  pdf.setTextColor(0, 0, 0);
  pdf.text(ticketId, bcX - 4, cardY + cardH / 2, { angle: 90, align: "center" });

  // Die-cut semicircular notches at dividers
  pdf.setFillColor(255, 255, 255);
  pdf.circle(div1X, cardY, notchR, "F");
  pdf.circle(div1X, cardY + cardH, notchR, "F");
  pdf.circle(div2X, cardY, notchR, "F");
  pdf.circle(div2X, cardY + cardH, notchR, "F");

  // Dashed lines at dividers
  pdf.setDrawColor(150, 150, 150);
  pdf.setLineDash([1.5, 1.5]);
  pdf.line(div1X, cardY + notchR, div1X, cardY + cardH - notchR);
  pdf.line(div2X, cardY + notchR, div2X, cardY + cardH - notchR);
  pdf.setLineDash([]);
}

// ==================== PAGE 2: TERMS & VERIFICATION ====================
function drawPage2(pdf, W, H, registration, event, emailLogoBase64, ticketLogoBase64, hasInter) {
  const font = getFont(hasInter);
  const ticketId = registration?.ticketId || registration?.id || "TKT-1793-AB12C";

  pdf.setFillColor(255, 255, 255);
  pdf.rect(0, 0, W, H, "F");

  // Outer border
  pdf.setDrawColor(0, 0, 0);
  pdf.setLineWidth(0.8);
  pdf.roundedRect(8, 8, W - 16, H - 16, 4, 4);

  // Perforated divider
  const divX = 100;
  pdf.setDrawColor(180, 180, 180);
  pdf.setLineDash([2, 2]);
  pdf.line(divX, 12, divX, H - 12);
  pdf.setLineDash([]);

  // Left side: Logo & Barcode
  const lm = 18;
  if (emailLogoBase64) {
    pdf.addImage(emailLogoBase64, "PNG", lm, 13, 72, 30);
  }

  const barcodeY = 46;
  drawBarcode(pdf, ticketId, lm, barcodeY, 75, 24);

  pdf.setFontSize(7.5);
  pdf.setFont(font, "bold");
  pdf.setTextColor(0, 0, 0);
  pdf.text("OFFICIAL TICKET NO.", lm, barcodeY + 30);
  pdf.text(ticketId, lm + 35, barcodeY + 30);

  // Right side: Terms & Instructions
  const rs = divX + 12;
  pdf.setFontSize(14);
  pdf.setFont(font, "bold");
  pdf.setTextColor(0, 0, 0);
  pdf.text("EVENT ENTRY & VERIFICATION GUIDELINES", rs, 20);

  const instructions = [
    "1. Present the QR code or Barcode at the entry gate on mobile or printed pass.",
    "2. Each entry pass is cryptographically signed and valid for one-time admission.",
    "3. Keep this pass safe and avoid sharing full ticket codes publicly.",
    "4. In case of gate verification issues, contact the event desk with your Ticket ID.",
    `5. Event: ${(event?.name || event?.title || "Event Pass").toUpperCase()} • Organized on TicketLelo.`,
  ];

  pdf.setFontSize(8.5);
  pdf.setFont(font, "normal");
  instructions.forEach((line, idx) => {
    pdf.text(line, rs, 32 + idx * 8);
  });

  if (ticketLogoBase64) {
    pdf.addImage(ticketLogoBase64, "PNG", W - 32, H - 24, 18, 12);
  }
}
