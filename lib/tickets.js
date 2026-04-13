import jsPDF from "jspdf";

export const generatePDFTicket = async (registration, event, qrCode) => {
  const pdf = new jsPDF("portrait", "mm", "a4");
  const W = pdf.internal.pageSize.getWidth();
  const H = pdf.internal.pageSize.getHeight();

  const margin = 20;
  const cardW = W - margin * 2;

  /* CARD */
  pdf.setFillColor(255, 255, 255);
  pdf.roundedRect(margin, margin, cardW, H - margin * 2, 8, 8, "F");

  /* HEADER */
  pdf.setFillColor(17, 24, 39);
  pdf.roundedRect(margin, margin, cardW, 40, 8, 8, "F");

  pdf.setTextColor(255, 255, 255);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(20);
  pdf.text("EVENT ENTRY PASS", W / 2, 35, { align: "center" });

  pdf.setFontSize(12);
  pdf.text(event?.name || "Event", W / 2, 45, { align: "center" });

  /* DATE */
  let formattedDate = "Date TBC";
  try {
    if (event?.date) {
      const d =
        typeof event.date.toDate === "function"
          ? event.date.toDate()
          : new Date(event.date);

      if (!isNaN(d)) {
        formattedDate = d.toLocaleDateString("en-US", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        });
      }
    }
  } catch {}

  /* EVENT INFO */
  pdf.setTextColor(50, 50, 50);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(11);

  pdf.text(`Date: ${formattedDate}`, margin + 15, 75);
  pdf.text(`Location: ${event?.location || "TBA"}`, margin + 15, 83);

  /* DIVIDER */
  pdf.setDrawColor(220, 220, 220);
  pdf.line(margin + 5, 95, W - margin - 5, 95);

  /* ATTENDEE DETAILS */
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(14);
  pdf.text("ATTENDEE DETAILS", margin + 15, 110);

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(12);

  let y = 125;

  const drawRow = (label, value) => {
    pdf.setFont("helvetica", "bold");
    pdf.text(label, margin + 15, y);

    pdf.setFont("helvetica", "normal");
    pdf.text(String(value || "-"), margin + 55, y);

    y += 10;
  };

  drawRow("Name:", registration?.fullName);
  drawRow("Email:", registration?.email);
  drawRow("Phone:", registration?.whatsappPhone);
  drawRow("Ticket ID:", registration?.ticketId);

  /* QR CENTERED */
  const qrSize = 75;
  const qrX = W / 2 - qrSize / 2;
  const qrY = y + 10;

  pdf.setDrawColor(200, 200, 200);
  pdf.roundedRect(qrX - 6, qrY - 6, qrSize + 12, qrSize + 12, 4, 4, "S");

  if (qrCode) pdf.addImage(qrCode, "PNG", qrX, qrY, qrSize, qrSize);

  /* SCAN TEXT */
  pdf.setTextColor(80, 80, 80);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(11);
  pdf.text("SCAN AT ENTRY GATE", W / 2, qrY + qrSize + 12, {
    align: "center",
  });

  /* STATUS BADGE */
  const valid = registration?.status !== "Used";
  const color = valid ? [16, 185, 129] : [220, 38, 38];

  pdf.setFillColor(...color);
  pdf.roundedRect(W / 2 - 30, qrY + qrSize + 20, 60, 14, 7, 7, "F");

  pdf.setTextColor(255, 255, 255);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(13);
  pdf.text(valid ? "VALID" : "USED", W / 2, qrY + qrSize + 29, {
    align: "center",
  });

  return pdf.output("blob");
};
