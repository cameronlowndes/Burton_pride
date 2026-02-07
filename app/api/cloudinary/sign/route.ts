import { NextResponse } from "next/server";
import crypto from "crypto";

export async function POST() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME!;
  const apiKey = process.env.CLOUDINARY_API_KEY!;
  const apiSecret = process.env.CLOUDINARY_API_SECRET!;
  const uploadPreset = process.env.CLOUDINARY_UPLOAD_PRESET!;

  const timestamp = Math.floor(Date.now() / 1000);

  // Add any params you’ll send from client (must match!)
  const folder = "burton-pride/competition";

  // Cloudinary signature base string must be params sorted alphabetically
  const paramsToSign = `folder=${folder}&timestamp=${timestamp}&upload_preset=${uploadPreset}`;

  const signature = crypto
    .createHash("sha1")
    .update(paramsToSign + apiSecret)
    .digest("hex");

  return NextResponse.json({
    cloudName,
    apiKey,
    timestamp,
    signature,
    uploadPreset,
    folder,
  });
}
