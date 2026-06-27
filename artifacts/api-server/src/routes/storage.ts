import { Router, type IRouter, type Request, type Response } from "express";
import { z } from "zod";
import { ObjectStorageService, ObjectNotFoundError } from "../lib/objectStorage";

const RequestUploadUrlBody = z.object({
  name: z.string(),
  size: z.number(),
  contentType: z.string(),
});

const RequestUploadUrlResponse = z.object({
  uploadURL: z.string(),
  objectPath: z.string(),
  metadata: z.object({ name: z.string(), size: z.number(), contentType: z.string() }),
});

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();

// ── Signed-URL cache ──────────────────────────────────────────────────────────
// Avoids regenerating a signed URL (and calling GCS) on every image request.
// TTL = 50 min so the cached URL is always valid (signs for 60 min).
const SIGNED_URL_TTL_MS = 50 * 60 * 1000;
const SIGNED_URL_SIGN_SEC = 60 * 60; // 60 min validity
const signedUrlCache = new Map<string, { url: string; expiresAt: number }>();

async function getCachedSignedUrl(cacheKey: string, sign: () => Promise<string>): Promise<string> {
  const cached = signedUrlCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.url;
  const url = await sign();
  signedUrlCache.set(cacheKey, { url, expiresAt: Date.now() + SIGNED_URL_TTL_MS });
  return url;
}

/**
 * POST /storage/uploads/request-url
 *
 * Request a presigned URL for file upload.
 * The client sends JSON metadata (name, size, contentType) — NOT the file.
 * Then uploads the file directly to the returned presigned URL.
 */
router.post("/storage/uploads/request-url", async (req: Request, res: Response) => {
  const parsed = RequestUploadUrlBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Missing or invalid required fields" });
    return;
  }

  try {
    const { name, size, contentType } = parsed.data;

    const uploadURL = await objectStorageService.getObjectEntityUploadURL();
    const objectPath = objectStorageService.normalizeObjectEntityPath(uploadURL);

    // Invalidate any cached signed URL for this path so the next read
    // always generates a fresh signed URL pointing to the new upload.
    const cacheKey = `object:${objectPath.replace(/^\/objects\//, "")}`;
    signedUrlCache.delete(cacheKey);

    res.json(
      RequestUploadUrlResponse.parse({
        uploadURL,
        objectPath,
        metadata: { name, size, contentType },
      }),
    );
  } catch (error) {
    req.log.error({ err: error }, "Error generating upload URL");
    res.status(500).json({ error: "Failed to generate upload URL" });
  }
});

/**
 * GET /storage/public-objects/*
 *
 * Serve public assets from PUBLIC_OBJECT_SEARCH_PATHS.
 * Uses a signed-URL redirect so the client fetches directly from GCS.
 */
router.get("/storage/public-objects/*filePath", async (req: Request, res: Response) => {
  try {
    const raw = req.params.filePath;
    const filePath = Array.isArray(raw) ? raw.join("/") : raw;
    const cacheKey = `public:${filePath}`;

    // Check cache first — avoids GCS round-trips on cache hit
    const cached = signedUrlCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      res.redirect(302, cached.url);
      return;
    }

    const file = await objectStorageService.searchPublicObject(filePath);
    if (!file) {
      res.status(404).json({ error: "File not found" });
      return;
    }

    const signedUrl = await getCachedSignedUrl(cacheKey, () =>
      objectStorageService.getSignedReadUrl(file, SIGNED_URL_SIGN_SEC)
    );
    // Prevent clients/proxies from caching the redirect — they must always
    // re-request so we can serve a fresh signed URL when content changes.
    res.setHeader("Cache-Control", "no-store");
    res.redirect(302, signedUrl);
  } catch (error) {
    req.log.error({ err: error }, "Error serving public object");
    res.status(500).json({ error: "Failed to serve public object" });
  }
});

/**
 * GET /storage/objects/*
 *
 * Serve object entities from PRIVATE_OBJECT_DIR.
 * Uses a signed-URL redirect so the client fetches directly from GCS —
 * eliminates the proxy bottleneck that caused 5-7 s image load times.
 */
router.get("/storage/objects/*path", async (req: Request, res: Response) => {
  try {
    const raw = req.params.path;
    const wildcardPath = Array.isArray(raw) ? raw.join("/") : raw;

    const objectPath = `/objects/${wildcardPath}`;
    const objectFile = await objectStorageService.getObjectEntityFile(objectPath);

    const [metadata] = await objectFile.getMetadata();
    const contentType = (metadata.contentType as string) || "application/octet-stream";
    const size = metadata.size ? Number(metadata.size) : undefined;

    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "public, max-age=3600");
    if (size) res.setHeader("Content-Length", String(size));

    const readStream = objectFile.createReadStream();
    readStream.on("error", (err) => {
      req.log.error({ err }, "Error streaming object");
      if (!res.headersSent) res.status(500).json({ error: "Failed to serve object" });
    });
    readStream.pipe(res);
  } catch (error) {
    if (error instanceof ObjectNotFoundError) {
      req.log.warn({ err: error }, "Object not found");
      res.status(404).json({ error: "Object not found" });
      return;
    }
    req.log.error({ err: error }, "Error serving object");
    res.status(500).json({ error: "Failed to serve object" });
  }
});

export default router;
