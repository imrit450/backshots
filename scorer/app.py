import os
import subprocess
import tempfile
import numpy as np
from flask import Flask, request, jsonify, send_file
from brisque import BRISQUE
import cv2

app = Flask(__name__)
brisque_obj = BRISQUE()  # load model once at startup

# ── Photo enhancement constants ─────────────────────────────────────────────
BILATERAL_D       = 9
BILATERAL_SIGMA_C = 75
BILATERAL_SIGMA_S = 75
CLAHE_CLIP_LIMIT  = 2.0
CLAHE_TILE_GRID   = (8, 8)
GAMMA             = 1.05
UNSHARP_SIGMA     = 1.0
UNSHARP_STRENGTH  = 1.4
UNSHARP_THRESHOLD = 8
SATURATION_SCALE  = 1.15

# ── Video enhancement FFmpeg filter chain ───────────────────────────────────
FFMPEG_FILTERS = ",".join([
    "hqdn3d=4:3:6:4.5",
    "unsharp=5:5:1.0:5:5:0.0",
    "eq=contrast=1.1:brightness=0.02:saturation=1.2",
])


def compute_flags(gray: np.ndarray, brisque_score: float) -> dict:
    mean_lum = float(np.mean(gray))
    return {
        "blurry":      brisque_score > 55,
        "dark":        mean_lum < 55,
        "overexposed": mean_lum > 210,
        "noisy":       brisque_score > 45 and 60 < mean_lum < 190,
    }


def _apply_gamma(channel: np.ndarray, gamma: float) -> np.ndarray:
    inv_gamma = 1.0 / gamma
    lut = np.array([((i / 255.0) ** inv_gamma) * 255 for i in range(256)], dtype=np.uint8)
    return cv2.LUT(channel, lut)


def _unsharp_mask(channel: np.ndarray, sigma: float, strength: float, threshold: int) -> np.ndarray:
    blurred = cv2.GaussianBlur(channel, (0, 0), sigma)
    diff = channel.astype(np.int16) - blurred.astype(np.int16)
    mask = np.abs(diff) > threshold
    sharpened = channel.astype(np.float32) + strength * diff * mask
    return np.clip(sharpened, 0, 255).astype(np.uint8)


def enhance_photo_buffer(img_bgr: np.ndarray) -> np.ndarray:
    denoised = cv2.bilateralFilter(img_bgr, BILATERAL_D, BILATERAL_SIGMA_C, BILATERAL_SIGMA_S)
    lab = cv2.cvtColor(denoised, cv2.COLOR_BGR2LAB)
    l, a, b = cv2.split(lab)
    clahe = cv2.createCLAHE(clipLimit=CLAHE_CLIP_LIMIT, tileGridSize=CLAHE_TILE_GRID)
    l = _apply_gamma(clahe.apply(l), GAMMA)
    l = _unsharp_mask(l, UNSHARP_SIGMA, UNSHARP_STRENGTH, UNSHARP_THRESHOLD)
    enhanced_bgr = cv2.cvtColor(cv2.merge([l, a, b]), cv2.COLOR_LAB2BGR)
    hsv = cv2.cvtColor(enhanced_bgr, cv2.COLOR_BGR2HSV).astype(np.float32)
    hsv[:, :, 1] = np.clip(hsv[:, :, 1] * SATURATION_SCALE, 0, 255)
    return cv2.cvtColor(hsv.astype(np.uint8), cv2.COLOR_HSV2BGR)


@app.route("/score", methods=["POST"])
def score_image():
    img_path = None
    try:
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

        img_bgr = cv2.imread(img_path)
        if img_bgr is None:
            return jsonify({"error": "Could not decode image"}), 422

        gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
        raw_brisque = float(brisque_obj.score(img_bgr))
        raw_brisque = max(0.0, min(100.0, raw_brisque))
        composite = round(100.0 - raw_brisque, 1)

        return jsonify({
            "score":       composite,
            "brisque_raw": raw_brisque,
            "flags":       compute_flags(gray, raw_brisque),
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500

    finally:
        if img_path and request.content_type and "multipart" in request.content_type:
            try:
                os.unlink(img_path)
            except OSError:
                pass


@app.route("/enhance/photo", methods=["POST"])
def enhance_photo():
    """
    Accepts multipart 'image' field.
    Returns the enhanced image as JPEG bytes.
    ~200–500ms on CPU for up to 12MP.
    """
    file = request.files.get("image")
    if not file:
        return jsonify({"error": "No image field"}), 400

    tmp_in = None
    try:
        suffix = os.path.splitext(file.filename or "photo.jpg")[1] or ".jpg"
        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as f:
            file.save(f.name)
            tmp_in = f.name

        img = cv2.imread(tmp_in, cv2.IMREAD_COLOR)
        if img is None:
            return jsonify({"error": "Cannot decode image"}), 422

        enhanced = enhance_photo_buffer(img)

        _, buf = cv2.imencode(".jpg", enhanced, [cv2.IMWRITE_JPEG_QUALITY, 92])
        import io
        return send_file(io.BytesIO(buf.tobytes()), mimetype="image/jpeg",
                         download_name="enhanced.jpg")

    except Exception as e:
        return jsonify({"error": str(e)}), 500

    finally:
        if tmp_in:
            try:
                os.unlink(tmp_in)
            except OSError:
                pass


@app.route("/enhance/video", methods=["POST"])
def enhance_video():
    """
    Accepts multipart 'video' field.
    Runs FFmpeg filter chain synchronously (~3–5s for 10s 1080p).
    Returns the enhanced MP4 bytes.
    """
    file = request.files.get("video")
    if not file:
        return jsonify({"error": "No video field"}), 400

    tmp_in = tmp_out = None
    try:
        suffix = os.path.splitext(file.filename or "video.mp4")[1] or ".mp4"
        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as f:
            file.save(f.name)
            tmp_in = f.name

        tmp_out = tmp_in + "_enhanced.mp4"

        cmd = [
            "ffmpeg", "-y",
            "-i", tmp_in,
            "-vf", FFMPEG_FILTERS,
            "-c:v", "libx264",
            "-crf", "18",
            "-preset", "fast",
            "-pix_fmt", "yuv420p",
            "-c:a", "copy",
            tmp_out,
        ]
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
        if result.returncode != 0:
            return jsonify({"error": f"FFmpeg failed: {result.stderr[-500:]}"}), 500

        return send_file(tmp_out, mimetype="video/mp4", download_name="enhanced.mp4")

    except subprocess.TimeoutExpired:
        return jsonify({"error": "FFmpeg timed out"}), 504

    except Exception as e:
        return jsonify({"error": str(e)}), 500

    finally:
        for p in [tmp_in, tmp_out]:
            if p:
                try:
                    os.unlink(p)
                except OSError:
                    pass


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"}), 200


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5001))
    app.run(host="0.0.0.0", port=port, debug=False)
