import { NextResponse } from "next/server";
import { adminDb, isFirebaseAdminReady } from "@/lib/firebase-admin";
import { Timestamp } from "firebase-admin/firestore";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

// Generate random coupon code
function generateCouponCode(prefix = "TICKET") {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = prefix + "-";
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export async function POST(request) {
  try {
    if (!isFirebaseAdminReady() || !adminDb) {
      return NextResponse.json(
        { success: false, error: "Firebase Admin SDK not configured" },
        { status: 503 },
      );
    }

    const { eventId, couponConfigs, eventName } = await request.json();

    if (!eventId || !couponConfigs || couponConfigs.length === 0) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 },
      );
    }

    console.log(`📋 Generating coupons for event: ${eventName || eventId}`);
    console.log(`📊 Configurations: ${couponConfigs.length} batches`);

    // Generate all coupons and store in Firestore
    const allCoupons = [];
    const couponsRef = adminDb.collection("coupons");

    for (const config of couponConfigs) {
      console.log(
        `🔄 Processing batch: ${config.quantity} coupons at ${config.discountPercent}% off`,
      );

      for (let i = 0; i < config.quantity; i++) {
        const code = generateCouponCode();
        const couponData = {
          code,
          eventId,
          discountPercent: config.discountPercent,
          validUntil: Timestamp.fromDate(new Date(config.validityDate)),
          isUsed: false,
          usedBy: null,
          usedAt: null,
          createdAt: Timestamp.now(),
        };

        //Store in Firestore
        await couponsRef.add(couponData);

        allCoupons.push({
          code,
          discount: config.discountPercent,
          validUntil: config.validityDate,
        });
      }
    }

    console.log(`✅ Generated ${allCoupons.length} coupons total`);

    // Create PDF
    const pdfDoc = await PDFDocument.create();
    const timesRomanFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    // Constants for layout
    const pageWidth = 595; // A4 width
    const pageHeight = 842; // A4 height
    const margin = 40;
    const couponsPerPage = 10;
    const couponHeight = 70;

    let currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
    let yPosition = pageHeight - margin;
    let couponCount = 0;

    // Header on first page
    // Draw header background with gradient effect
    currentPage.drawRectangle({
      x: 0,
      y: yPosition - 55,
      width: pageWidth,
      height: 65,
      color: rgb(0.06, 0.65, 0.4), // Emerald green
    });

    // Title
    currentPage.drawText(`DISCOUNT COUPONS`, {
      x: margin,
      y: yPosition - 25,
      size: 26,
      font: boldFont,
      color: rgb(1, 1, 1),
    });

    // Event name
    currentPage.drawText(eventName || "Event", {
      x: margin,
      y: yPosition - 45,
      size: 13,
      font: timesRomanFont,
      color: rgb(0.95, 0.95, 0.95),
    });

    yPosition -= 65;

    // Info line
    const infoText = `Generated: ${new Date().toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })}  |  Total Coupons: ${allCoupons.length}`;

    currentPage.drawText(infoText, {
      x: margin,
      y: yPosition - 5,
      size: 9,
      font: timesRomanFont,
      color: rgb(0.5, 0.5, 0.5),
    });

    yPosition -= 20;

    // Draw coupons
    for (const coupon of allCoupons) {
      if (couponCount > 0 && couponCount % couponsPerPage === 0) {
        currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
        yPosition = pageHeight - margin;
      }

      // Main coupon card background with shadow effect
      // Shadow
      currentPage.drawRectangle({
        x: margin + 2,
        y: yPosition - couponHeight - 2,
        width: pageWidth - 2 * margin,
        height: couponHeight,
        color: rgb(0.85, 0.85, 0.85),
      });

      // Main card
      currentPage.drawRectangle({
        x: margin,
        y: yPosition - couponHeight,
        width: pageWidth - 2 * margin,
        height: couponHeight,
        color: rgb(1, 1, 1), // White background
        borderColor: rgb(0.06, 0.65, 0.4), // Emerald border
        borderWidth: 2,
      });

      // Left emerald accent bar
      currentPage.drawRectangle({
        x: margin,
        y: yPosition - couponHeight,
        width: 6,
        height: couponHeight,
        color: rgb(0.06, 0.65, 0.4),
      });

      // Discount badge (right side) - FIXED LAYOUT
      const badgeX = pageWidth - margin - 80;
      const badgeY = yPosition - 45;
      const badgeWidth = 65;
      const badgeHeight = 50;

      // Badge background
      currentPage.drawRectangle({
        x: badgeX,
        y: badgeY,
        width: badgeWidth,
        height: badgeHeight,
        color: rgb(0.9, 0.1, 0.1), // Red
        borderColor: rgb(0.7, 0, 0),
        borderWidth: 2,
      });

      // Percentage value (centered)
      const percentText = `${coupon.discount}%`;
      currentPage.drawText(percentText, {
        x: badgeX + 10,
        y: badgeY + 32,
        size: 18,
        font: boldFont,
        color: rgb(1, 1, 1),
      });

      // "OFF" text (centered below)
      currentPage.drawText("OFF", {
        x: badgeX + 16,
        y: badgeY + 12,
        size: 14,
        font: boldFont,
        color: rgb(1, 1, 1),
      });

      // Coupon code section (left side)
      const contentX = margin + 18;

      // Label
      currentPage.drawText("COUPON CODE", {
        x: contentX,
        y: yPosition - 18,
        size: 7,
        font: timesRomanFont,
        color: rgb(0.5, 0.5, 0.5),
      });

      // Code box
      currentPage.drawRectangle({
        x: contentX,
        y: yPosition - 45,
        width: 200,
        height: 24,
        color: rgb(0.97, 0.97, 0.97),
        borderColor: rgb(0.06, 0.65, 0.4),
        borderWidth: 1.5,
      });

      // Code text
      currentPage.drawText(coupon.code, {
        x: contentX + 6,
        y: yPosition - 38,
        size: 13,
        font: boldFont,
        color: rgb(0.06, 0.65, 0.4),
      });

      // Validity date
      const validDate = new Date(coupon.validUntil).toLocaleDateString(
        "en-US",
        { month: "short", day: "numeric", year: "numeric" },
      );
      currentPage.drawText(`Valid Until: ${validDate}`, {
        x: contentX,
        y: yPosition - 55,
        size: 8,
        font: timesRomanFont,
        color: rgb(0.4, 0.4, 0.4),
      });

      // Divider line
      currentPage.drawLine({
        start: { x: margin + 10, y: yPosition - couponHeight + 5 },
        end: { x: pageWidth - margin - 10, y: yPosition - couponHeight + 5 },
        thickness: 0.3,
        color: rgb(0.9, 0.9, 0.9),
      });

      yPosition -= couponHeight + 8;
      couponCount++;
    }

    // Add footer to all pages
    const pages = pdfDoc.getPages();
    pages.forEach((page, index) => {
      const footerY = 25;

      // Footer line
      page.drawLine({
        start: { x: margin, y: footerY + 15 },
        end: { x: pageWidth - margin, y: footerY + 15 },
        thickness: 0.5,
        color: rgb(0.8, 0.8, 0.8),
      });

      // Footer text
      page.drawText(
        `${eventName || "TicketLelo"} - Discount Coupons | Page ${index + 1} of ${pages.length}`,
        {
          x: margin,
          y: footerY,
          size: 8,
          font: timesRomanFont,
          color: rgb(0.6, 0.6, 0.6),
        },
      );
    });

    // Generate PDF bytes
    const pdfBytes = await pdfDoc.save();
    const pdfBase64 = Buffer.from(pdfBytes).toString("base64");

    return NextResponse.json({
      success: true,
      totalCoupons: allCoupons.length,
      pdfData: pdfBase64,
      message: `Successfully generated ${allCoupons.length} coupons`,
    });
  } catch (error) {
    console.error("❌ Error generating coupons PDF:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
