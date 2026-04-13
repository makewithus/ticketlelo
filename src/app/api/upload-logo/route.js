import { NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";

// Increase timeout for logo upload (in seconds)
export const maxDuration = 60; // 60 seconds max

/**
 * Cloudinary Logo Upload API
 *
 * This API uploads event logos to Cloudinary
 * Each organiser can upload their event logo
 *
 * Setup:
 * 1. Create Cloudinary account at https://cloudinary.com
 * 2. Get credentials from Dashboard → Settings → API Keys
 * 3. Add to .env:
 *    CLOUDINARY_CLOUD_NAME=your_cloud_name
 *    CLOUDINARY_API_KEY=your_api_key
 *    CLOUDINARY_API_SECRET=your_api_secret
 */

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function POST(request) {
  try {
    // Check if Cloudinary is configured
    if (
      !process.env.CLOUDINARY_CLOUD_NAME ||
      !process.env.CLOUDINARY_API_KEY ||
      !process.env.CLOUDINARY_API_SECRET
    ) {
      return NextResponse.json(
        {
          error:
            "Cloudinary not configured. Please add credentials to .env file.",
          instructions: {
            step1: "Create account at https://cloudinary.com",
            step2: "Get credentials from Dashboard → Settings → API Keys",
            step3:
              "Add to .env: CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET",
          },
        },
        { status: 500 },
      );
    }

    const formData = await request.formData();
    const file = formData.get("file");
    const eventId = formData.get("eventId");

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Validate file size (max 500KB)
    if (file.size > 500 * 1024) {
      return NextResponse.json(
        { error: "File size must be less than 500KB" },
        { status: 400 },
      );
    }

    // Validate file type
    if (!file.type.startsWith("image/")) {
      return NextResponse.json(
        { error: "File must be an image" },
        { status: 400 },
      );
    }

    console.log("📤 Uploading logo to Cloudinary...");
    console.log("File name:", file.name);
    console.log("File size:", (file.size / 1024).toFixed(2), "KB");

    // Convert file to buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Upload to Cloudinary
    const uploadResult = await new Promise((resolve, reject) => {
      cloudinary.uploader
        .upload_stream(
          {
            folder: "ticketlelo/event-logos", // Organize in folder
            public_id: `event_${eventId}_${Date.now()}`, // Unique filename
            resource_type: "image",
            transformation: [
              { width: 500, height: 500, crop: "limit" }, // Resize if larger
              { quality: "auto" }, // Auto optimize quality
              { fetch_format: "auto" }, // Auto format (webp, etc.)
            ],
          },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          },
        )
        .end(buffer);
    });

    console.log("✅ Logo uploaded to Cloudinary");
    console.log("URL:", uploadResult.secure_url);

    return NextResponse.json({
      success: true,
      url: uploadResult.secure_url,
      publicId: uploadResult.public_id,
      format: uploadResult.format,
      width: uploadResult.width,
      height: uploadResult.height,
    });
  } catch (error) {
    console.error("❌ Error uploading to Cloudinary:", error);
    return NextResponse.json(
      {
        error: error.message || "Failed to upload image",
        details: error.error?.message || "",
      },
      { status: 500 },
    );
  }
}
