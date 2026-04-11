import os
import tempfile
import numpy as np
from flask import Flask, request, jsonify
from brisque import BRISQUE
import cv2

app = Flask(__name__)
brisque_obj = BRISQUE()  # load model once at startup


def compute_flags(gray: np.ndarray, brisque_score: float) -> dict:
    mean_lum = float(np.mean(gray))
    return {
        "blurry":      brisque_score > 55,
        "dark":        mean_lum < 55,
        "overexposed": mean_lum > 210,
        "noisy":       brisque_score > 45 and 60 < mean_lum < 190,
    }


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


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"}), 200


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5001))
    app.run(host="0.0.0.0", port=port, debug=False)
