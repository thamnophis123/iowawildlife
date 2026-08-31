const IDENTIFY_MAX_EDGE = 1600;
const IDENTIFY_JPEG_QUALITY = 0.8;

async function bitmapFromFile(file: File) {
  try {
    return await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return createImageBitmap(file);
  }
}

export async function resizeImageForIdentify(file: File): Promise<File> {
  const bitmap = await bitmapFromFile(file);
  const scale = Math.min(
    1,
    IDENTIFY_MAX_EDGE / Math.max(bitmap.width, bitmap.height),
  );
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) {
    bitmap.close();
    throw new Error("Could not resize this photo.");
  }

  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (next) => {
        if (next) {
          resolve(next);
        } else {
          reject(new Error("Could not resize this photo."));
        }
      },
      "image/jpeg",
      IDENTIFY_JPEG_QUALITY,
    );
  });

  return new File([blob], "identify.jpg", { type: "image/jpeg" });
}
