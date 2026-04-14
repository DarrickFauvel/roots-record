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

export function getSignedUrl(publicId: string, transformation?: string): string {
  return cloudinary.url(publicId, {
    secure: true,
    sign_url: true,
    type: "authenticated",
    ...(transformation ? { raw_transformation: transformation } : {}),
  });
}

export async function deleteDocument(publicId: string): Promise<void> {
  await cloudinary.uploader.destroy(publicId, { resource_type: "image", type: "authenticated" });
}
