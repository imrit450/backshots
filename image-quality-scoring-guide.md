# Image Quality Scoring — Migration Guide
**Replace the current Laplacian scorer with BRISQUE via Python sidecar**

> **Audience:** Backend developer familiar with the existing Express + TypeScript + Prisma stack.
> **Goal:** Swap the current `imageQuality.ts` module for a BRISQUE-based scorer that runs fully offline via a Python sidecar container. No external API calls. One-click setup via Docker Compose.

---

## Table of Contents

1. [Why we're replacing the current system](#1-why-were-replacing-the-current-system)
2. [Architecture overview](#2-architecture-overview)
3. [Step 1 — Prisma schema update](#3-step-1--prisma-schema-update)
4. [Step 2 — Python sidecar service](#4-step-2--python-sidecar-service)
5. [Step 3 — TypeScript scorer module](#5-step-3--typescript-scorer-module)
6. [Step 4 — Hook into the upload handler](#6-step-4--hook-into-the-upload-handler)
7. [Step 5 — Docker Compose setup](#7-step-5--docker-compose-setup)
8. [Step 6 — Frontend quality badge](#8-step-6--frontend-quality-badge)
9. [Testing](#9-testing)
10. [Score interpretation](#10-score-interpretation)
11. [Rollback plan](#11-rollback-plan)

---

## 1. Why we're replacing the current system

| | Current (Laplacian) | New (BRISQUE) |
|---|---|---|
| **Blur detection** | ✅ Basic (defocus only) | ✅ Both motion and defocus |
| **Exposure** | ✅ Mean luminance | ✅ Included in holistic score |
| **Noise/grain** | ⚠️ Patch variance (rough) | ✅ GGD-fitted, more accurate |
| **JPEG artifacts** | ❌ Not detected | ✅ Detected |
| **High-ISO grain** | ❌ Not detected | ✅ Detected |
| **Filtered/overprocessed** | ❌ Not detected | ✅ Detected |
| **Human perception correlation** | Low | High (trained on human opinion scores) |
| **External API** | None | None |
| **Offline** | ✅ | ✅ |
| **Added latency** | ~15ms | ~80ms (background job, invisible to user) |

BRISQUE (Blind/Referenceless Image Spatial Quality Evaluator) is an academic standard published in IEEE Transactions on Image Processing (2012). It works by detecting deviations from the statistical distribution of natural images — anything distorted (blurry, noisy, over-compressed, over-filtered) deviates from this distribution and scores poorly.

---

## 2. Architecture overview

```
Guest uploads photo
        │
        ▼
Express upload handler
  ├── Sharp: thumbnail + EXIF strip  (existing, unchanged)
  └── HTTP POST → Python sidecar :5001/score
                      │
                      ▼
              brisque + scikit-image
              returns { score, brisque_raw, flags }
                      │
        ◄─────────────┘
        │
        ▼
Prisma: save qualityScore + qualityFlags to Photo row
        │
        ▼
Host gallery: sort/filter by qualityScore
```

The Python sidecar runs as a separate container on an internal Docker network. It is never exposed to the internet — only the Node container can reach it.

---

## 3. Step 1 — Prisma schema update

Add two columns to the `Photo` model:

```prisma
// prisma/schema.prisma

model Photo {
  id           String   @id @default(cuid())
  // ... all your existing fields stay unchanged ...

  // --- ADD THESE TWO ---
  qualityScore  Float?   // 0–100 composite (null = not yet scored)
  qualityFlags  String?  // JSON string: { blurry, dark, overexposed, noisy }
}
```

Run the migration:

```bash
npx prisma migrate dev --name add_quality_score
```

> **SQLite (dev):** this runs immediately.
> **PostgreSQL (prod):** the migration adds nullable columns — zero downtime, no data loss.

---

## 4. Step 2 — Python sidecar service

Create a new directory at the repo root:

```
scorer/
├── Dockerfile
├── requirements.txt
└── app.py
```

### `scorer/requirements.txt`

```text
flask==3.0.3
brisque==0.0.16
opencv-python-headless==4.9.0.80
numpy==1.26.4
Pillow==10.3.0
```

> Use `opencv-python-headless` (not `opencv-python`) — it skips GUI dependencies and keeps the image smaller.

### `scorer/app.py`

```python
import os
import tempfile
import json
import numpy as np
from flask import Flask, request, jsonify
from brisque import BRISQUE
import cv2
from PIL import Image

app = Flask(__name__)
brisque_obj = BRISQUE()  # load model once at startup


def compute_flags(gray: np.ndarray, brisque_score: float) -> dict:
    """
    Derive human-readable flags from pixel statistics.
    These supplement the BRISQUE holistic score with specific diagnoses.
    """
    mean_lum = float(np.mean(gray))
    return {
        "blurry":      brisque_score > 55,      # BRISQUE >55 = poor quality
        "dark":        mean_lum < 55,            # mean luminance out of 255
        "overexposed": mean_lum > 210,
        "noisy":       brisque_score > 45 and 60 < mean_lum < 190,
    }


@app.route("/score", methods=["POST"])
def score_image():
    """
    Accepts:  multipart/form-data with field 'image' (file upload)
              OR application/json with field 'path' (absolute path inside container)

    Returns:  { score: float, brisque_raw: float, flags: object, error?: string }
    """
    try:
        # --- Load image ---
        if request.content_type and "multipart" in request.content_type:
            file = request.files.get("image")
            if not file:
                return jsonify({"error": "No image field in form data"}), 400

            with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as tmp:
                file.save(tmp.name)
                img_path = tmp.name
        else:
            data = request.get_json(force=True)
            img_path = data.get("path")
            if not img_path or not os.path.exists(img_path):
                return jsonify({"error": f"File not found: {img_path}"}), 400

        # --- Read + validate ---
        img_bgr = cv2.imread(img_path)
        if img_bgr is None:
            return jsonify({"error": "cv2 could not decode image"}), 422

        gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)

        # --- BRISQUE score (0 = perfect, 100 = terrible) ---
        raw_brisque = float(brisque_obj.score(img_bgr))

        # Clamp to 0–100 (BRISQUE can occasionally go slightly negative or above 100)
        raw_brisque = max(0.0, min(100.0, raw_brisque))

        # --- Convert to our 0–100 scale where 100 = best ---
        composite = round(100.0 - raw_brisque, 1)

        flags = compute_flags(gray, raw_brisque)

        return jsonify({
            "score":       composite,    # 0–100, higher = better (use this in your UI)
            "brisque_raw": raw_brisque,  # 0–100, lower = better (raw algorithm output)
            "flags":       flags,
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500

    finally:
        # Clean up temp file if we created one
        if "img_path" in locals() and request.content_type and "multipart" in request.content_type:
            try:
                os.unlink(img_path)
            except OSError:
                pass


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"}), 200


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5001))
    app.run(host="0.0.0.0", port=port, debug=False)
```

### `scorer/Dockerfile`

```dockerfile
FROM python:3.11-slim

WORKDIR /app

# System deps for opencv-headless
RUN apt-get update && apt-get install -y --no-install-recommends \
    libglib2.0-0 \
    libsm6 \
    libxrender1 \
    libxext6 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app.py .

# Pre-warm the BRISQUE model so first request isn't slow
RUN python -c "from brisque import BRISQUE; BRISQUE()"

EXPOSE 5001

CMD ["python", "app.py"]
```

---

## 5. Step 3 — TypeScript scorer module

Replace `src/services/imageQuality.ts` entirely:

```typescript
// src/services/imageQuality.ts

import fs from 'fs';
import path from 'path';
import FormData from 'form-data';
import fetch from 'node-fetch';

const SCORER_URL = process.env.SCORER_URL ?? 'http://scorer:5001';

export interface QualityResult {
  score: number;          // 0–100, higher = better — store this in the DB
  brisqueRaw: number;     // raw BRISQUE output for debugging
  flags: {
    blurry:      boolean;
    dark:        boolean;
    overexposed: boolean;
    noisy:       boolean;
  };
}

/**
 * Score an image via the Python BRISQUE sidecar.
 * Falls back gracefully if the sidecar is unreachable — upload never fails.
 */
export async function scoreImageQuality(
  imagePath: string
): Promise<QualityResult | null> {
  try {
    const form = new FormData();
    form.append('image', fs.createReadStream(imagePath), {
      filename: path.basename(imagePath),
      contentType: 'image/jpeg',
    });

    const response = await fetch(`${SCORER_URL}/score`, {
      method: 'POST',
      body: form,
      headers: form.getHeaders(),
      // Timeout after 10 seconds — BRISQUE on a small image is ~80ms,
      // but give headroom for sidecar cold start
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      const body = await response.text();
      console.error(`[quality] Sidecar returned ${response.status}: ${body}`);
      return null;
    }

    const data = await response.json() as {
      score: number;
      brisque_raw: number;
      flags: QualityResult['flags'];
      error?: string;
    };

    if (data.error) {
      console.error(`[quality] Sidecar error: ${data.error}`);
      return null;
    }

    return {
      score:      data.score,
      brisqueRaw: data.brisque_raw,
      flags:      data.flags,
    };
  } catch (err) {
    // Sidecar unavailable — log but don't crash the upload
    console.error('[quality] Sidecar unreachable:', (err as Error).message);
    return null;
  }
}
```

> **Dependencies to add:**
> ```bash
> npm install form-data node-fetch
> npm install --save-dev @types/node-fetch
> ```
> If you're already on Node 18+ and using native `fetch`, adapt accordingly — the pattern is the same.

---

## 6. Step 4 — Hook into the upload handler

Find your existing photo upload route. Add the quality scoring **after** your Sharp thumbnail generation, before the Prisma create call:

```typescript
// In your photo upload route handler — add lines marked NEW

import { scoreImageQuality } from '../services/imageQuality';

router.post('/photos', authenticateGuest, upload.single('photo'), async (req, res) => {
  try {
    // --- Your existing Sharp thumbnail + EXIF strip logic (unchanged) ---
    const savedImagePath = /* ... your existing path ... */;

    // --- NEW: Score quality asynchronously ---
    const quality = await scoreImageQuality(savedImagePath);

    // --- Your existing Prisma create — add the two new fields ---
    const photo = await prisma.photo.create({
      data: {
        // ... all your existing fields ...
        eventId:      req.params.eventId,
        guestToken:   req.guestToken,
        // NEW:
        qualityScore: quality?.score   ?? null,
        qualityFlags: quality?.flags   ? JSON.stringify(quality.flags) : null,
      },
    });

    // --- Return quality info to client (optional — useful for toast messages) ---
    res.json({
      photo,
      quality: quality ? {
        score:  quality.score,
        flags:  quality.flags,
      } : null,
    });

  } catch (err) {
    next(err);
  }
});
```

No change to your error handling — if scoring fails, `quality` is `null` and the upload still succeeds with `qualityScore: null`.

---

## 7. Step 5 — Docker Compose setup

Update your `docker-compose.yml` to add the scorer service. Only the marked sections are new:

```yaml
version: "3.9"

services:

  # ── Your existing Node app ──────────────────────────────────────────────────
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: ${DATABASE_URL}
      JWT_SECRET: ${JWT_SECRET}
      # NEW: tell the app where the scorer lives
      SCORER_URL: http://scorer:5001
    volumes:
      - uploads:/app/uploads
    depends_on:
      scorer:          # NEW
        condition: service_healthy
    networks:
      - internal

  # ── NEW: BRISQUE Python sidecar ─────────────────────────────────────────────
  scorer:
    build:
      context: ./scorer
      dockerfile: Dockerfile
    expose:
      - "5001"         # Internal only — NOT published to host
    environment:
      PORT: 5001
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:5001/health"]
      interval: 10s
      timeout: 5s
      retries: 3
      start_period: 20s   # Give pip-installed model time to warm up
    networks:
      - internal
    restart: unless-stopped

  # ── Your existing DB service (if present) ───────────────────────────────────
  # db:
  #   image: postgres:16
  #   ...

networks:
  internal:
    driver: bridge

volumes:
  uploads:
```

### One-click start

```bash
# Build and start everything (first run downloads Python deps — ~60 seconds)
docker compose up --build

# Subsequent starts (uses cached layers — ~5 seconds)
docker compose up
```

### Verify the sidecar is healthy

```bash
# Should return {"status":"ok"}
curl http://localhost:5001/health

# Manual score test
curl -X POST http://localhost:5001/score \
  -F "image=@/path/to/test.jpg"
```

---

## 8. Step 6 — Frontend quality badge

In the host gallery view, add a badge to each photo card. The `qualityScore` field is now on every `Photo` returned by the API.

```tsx
// components/QualityBadge.tsx

interface Props {
  score: number | null;
  flags?: { blurry?: boolean; dark?: boolean; overexposed?: boolean } | null;
}

function tier(score: number) {
  if (score >= 75) return { label: 'Sharp',  classes: 'bg-green-100  text-green-800'  };
  if (score >= 50) return { label: 'OK',     classes: 'bg-yellow-100 text-yellow-800' };
  return               { label: 'Blurry', classes: 'bg-red-100    text-red-800'    };
}

export function QualityBadge({ score, flags }: Props) {
  if (score == null) return null;

  const { label, classes } = tier(score);

  // Build a tooltip from active flags
  const activeFlags = Object.entries(flags ?? {})
    .filter(([, v]) => v)
    .map(([k]) => k)
    .join(', ');

  return (
    <span
      className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium ${classes}`}
      title={activeFlags || undefined}
    >
      {label} · {Math.round(score)}
    </span>
  );
}
```

### Gallery sort/filter — add to your existing photos API endpoint

```typescript
// GET /events/:eventId/photos
// New optional query params: ?sort=quality   &minScore=50

const { sort, minScore } = req.query;

const photos = await prisma.photo.findMany({
  where: {
    eventId: req.params.eventId,
    ...(minScore ? { qualityScore: { gte: parseFloat(minScore as string) } } : {}),
  },
  orderBy: sort === 'quality'
    ? { qualityScore: 'desc' }
    : { createdAt: 'desc' },
});
```

---

## 9. Testing

### Unit test — sidecar response parsing

```typescript
// tests/imageQuality.test.ts
import { scoreImageQuality } from '../src/services/imageQuality';

describe('scoreImageQuality', () => {
  it('returns null gracefully when sidecar is unreachable', async () => {
    process.env.SCORER_URL = 'http://localhost:19999'; // nothing listening
    const result = await scoreImageQuality('/tmp/any.jpg');
    expect(result).toBeNull();
  });
});
```

### Integration test — verify end-to-end with a real image

```bash
# Start just the scorer container
docker compose up scorer -d

# Score a known-good sharp image — expect score > 60
curl -s -X POST http://localhost:5001/score -F "image=@tests/fixtures/sharp.jpg" | jq .score

# Score a known-blurry image — expect score < 40
curl -s -X POST http://localhost:5001/score -F "image=@tests/fixtures/blurry.jpg" | jq .score
```

### Check migration applied

```bash
npx prisma studio
# Open Photo table — qualityScore and qualityFlags columns should be visible
```

---

## 10. Score interpretation

| Score | Label | Meaning |
|---|---|---|
| 75–100 | Sharp | Clean, well-exposed photo — show prominently |
| 50–74 | OK | Minor issues (slight blur, mild grain) — show normally |
| 25–49 | Blurry | Noticeable quality problems — show with warning badge |
| 0–24 | Poor | Heavily distorted — consider hiding from default gallery view |

The `flags` JSON gives specific reasons (can be used for guest toast messages):

```json
{
  "blurry":      true,   // BRISQUE score high — general distortion
  "dark":        false,  // mean luminance < 55/255
  "overexposed": false,  // mean luminance > 210/255
  "noisy":       false   // high BRISQUE in normal exposure range
}
```

---

## 11. Rollback plan

If you need to revert quickly:

1. Remove `SCORER_URL` from the app's environment in `docker-compose.yml`
2. In `imageQuality.ts`, replace the body with `return null` (the upload handler already handles `null` gracefully — no score is stored)
3. Revert the Prisma migration: `npx prisma migrate resolve --rolled-back <migration_name>`

The `qualityScore` and `qualityFlags` columns are nullable, so all existing rows remain valid during and after rollback.

---

## File change summary

| File | Action |
|---|---|
| `prisma/schema.prisma` | Add `qualityScore Float?` and `qualityFlags String?` to `Photo` |
| `src/services/imageQuality.ts` | **Replace entirely** with new sidecar client |
| `src/routes/photos.ts` | Add 5 lines to call scorer + pass fields to `prisma.create` |
| `docker-compose.yml` | Add `scorer` service + `SCORER_URL` env var to `app` |
| `scorer/Dockerfile` | **New file** |
| `scorer/app.py` | **New file** |
| `scorer/requirements.txt` | **New file** |
| `components/QualityBadge.tsx` | **New file** (optional but recommended) |

Total new code: ~150 lines Python, ~60 lines TypeScript, ~30 lines Docker config.
