/** Bundled cover photos an admin can pick instead of uploading one. */
export const BUNDLED_COVERS = ["foto-1", "foto-2", "foto-3", "foto-4", "foto-5", "foto-6"];

export const FIELD_PHOTOS_BUCKET = "field-photos";

/** A field's cover: a bundled key ("foto-3") or the public URL of an uploaded photo. */
export function coverSrc(cover: string) {
  return cover.startsWith("http") ? cover : `/fotos/canchas/${cover}.jpg`;
}
