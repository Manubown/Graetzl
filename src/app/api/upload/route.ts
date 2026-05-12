import { NextResponse } from "next/server";
import sharp from "sharp";
import { createClient } from "@/lib/supabase/server";

// Force Node runtime (Sharp is native; can't run on Edge).
export const runtime = "nodejs";

const MAX_INPUT_BYTES = 12 * 1024 * 1024; // 12 MB — generous; Sharp will shrink
const MAX_DIMENSION = 2000;                // long edge
const WEBP_QUALITY = 82;

/**
 * POST /api/upload
 *
 * Accepts a single multipart `file` field. Runs the bytes through Sharp:
 *  • Strips ALL metadata (EXIF, XMP, ICC, IPTC) — GDPR essential.
 *    Photos taken on phones embed GPS, timestamps, device IDs.
 *  • Resizes the long edge down to 2000px (no-op for smaller images).
 *  • Re-encodes as WebP for size + cacheability.
 *
 * Uploads to the public `pin-photos` bucket under `<uid>/<random>.webp`,
 * returns the public URL.
 *
 * Auth: required. RLS on storage.objects double-checks ownership.
 */
export async function POST(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();
  if (userErr || !user) {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Ungültiger Request." }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: "Keine Datei gefunden." }, { status: 400 });
  }
  if (file.size > MAX_INPUT_BYTES) {
    return NextResponse.json(
      { error: `Datei zu groß (max ${MAX_INPUT_BYTES / 1024 / 1024} MB).` },
      { status: 413 },
    );
  }

  const inputBuf = Buffer.from(await file.arrayBuffer());

  // --- Sharp pipeline: strip metadata, resize, re-encode ------------
  let processedBuf: Buffer;
  try {
    processedBuf = await sharp(inputBuf, { failOn: "error" })
      // .rotate() honours EXIF orientation, then strips it.
      .rotate()
      .resize({
        width: MAX_DIMENSION,
        height: MAX_DIMENSION,
        fit: "inside",
        withoutEnlargement: true,
      })
      // No `.withMetadata()` call → all metadata dropped, including GPS.
      .webp({ quality: WEBP_QUALITY })
      .toBuffer();
  } catch (err) {
    console.error("[upload] Sharp failed:", err);
    return NextResponse.json(
      { error: "Bild konnte nicht verarbeitet werden." },
      { status: 400 },
    );
  }

  // --- Upload to Supabase Storage -----------------------------------
  const fileName = `${user.id}/${crypto.randomUUID()}.webp`;
  const { error: uploadErr } = await supabase.storage
    .from("pin-photos")
    .upload(fileName, processedBuf, {
      contentType: "image/webp",
      cacheControl: "31536000", // 1 year — files are immutable by name
      upsert: false,
    });

  if (uploadErr) {
    console.error("[upload] storage upload failed:", uploadErr);
    return NextResponse.json(
      { error: uploadErr.message ?? "Upload fehlgeschlagen." },
      { status: 500 },
    );
  }

  const { data: publicUrlData } = supabase.storage
    .from("pin-photos")
    .getPublicUrl(fileName);

  return NextResponse.json({
    url: publicUrlData.publicUrl,
    bytes: processedBuf.length,
  });
}
