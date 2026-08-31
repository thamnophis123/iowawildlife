const EXTENSIONS_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
};

const ALLOWED_EXTENSIONS = new Set([
  "jpg",
  "jpeg",
  "png",
  "webp",
  "heic",
  "heif",
]);

export const PHOTO_ACCEPT =
  "image/jpeg,image/png,image/webp,image/heic,image/heif,.jpg,.jpeg,.png,.webp,.heic,.heif";

export function photoExtension(file: File): string | null {
  const fromType = EXTENSIONS_BY_TYPE[file.type];
  if (fromType) {
    return fromType;
  }

  const raw = file.name.split(".").pop()?.toLowerCase();
  if (!raw || !ALLOWED_EXTENSIONS.has(raw)) {
    return null;
  }

  return raw === "jpeg" ? "jpg" : raw;
}
