import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function uploadDocument(
  buffer: Buffer,
  options: { folder?: string; public_id?: string } = {}
): Promise<{ public_id: string; secure_url: string }> {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: options.folder ?? "roots-record",
        public_id: options.public_id,
        resource_type: "auto",
        type: "authenticated",
      },
      (error, result) => {
        if (error || !result) return reject(error ?? new Error("Upload failed"));
        resolve({ public_id: result.public_id, secure_url: result.secure_url });
      }
    );
    stream.end(buffer);
  });
}

export function getSignedUrl(
  publicId: string,
  transformation?: string,
  crop?: { x: number; y: number; w: number; h: number } | null
): string {
  let finalTransform = '';
  if (crop && Number.isFinite(crop.x) && Number.isFinite(crop.y) && Number.isFinite(crop.w) && Number.isFinite(crop.h)) {
    const { x, y, w, h } = crop;
    const cropStr = `c_crop,fl_relative,w_${w.toFixed(4)},h_${h.toFixed(4)},x_${x.toFixed(4)},y_${y.toFixed(4)}`;
    finalTransform = transformation ? `${cropStr}/${transformation}` : cropStr;
  } else {
    finalTransform = transformation ?? '';
  }
  return cloudinary.url(publicId, {
    secure: true,
    sign_url: true,
    type: "authenticated",
    ...(finalTransform ? { raw_transformation: finalTransform } : {}),
  });
}

export async function deleteDocument(publicId: string): Promise<void> {
  await cloudinary.uploader.destroy(publicId, { resource_type: "image", type: "authenticated" });
}
