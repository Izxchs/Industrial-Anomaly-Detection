import os
from io import BytesIO
from typing import Dict

import numpy as np
from PIL import Image
from fastapi import FastAPI, File, UploadFile, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from anomalib.deploy import OpenVINOInferencer


# ---------------------------------------------------------
# PATHS & GLOBAL CONFIG
# ---------------------------------------------------------

# BASE_MODEL_DIR = <repo_root>/models (relative, not hard-coded drive)
BASE_MODEL_DIR = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "models")
)

# The model types we support as individual models.
# "hybrid" is handled separately as a virtual model.
VALID_BASE_MODELS = ["padim", "patchcore"]

# Cache for loaded OpenVINOInferencer instances
CACHED_INFERENCERS: Dict[str, OpenVINOInferencer] = {}


# ---------------------------------------------------------
# FASTAPI APP SETUP
# ---------------------------------------------------------

app = FastAPI(title="Anomaly Detection API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # safe for Electron / local tools
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------
# UTILS: MODEL DISCOVERY & LOADING
# ---------------------------------------------------------

def discover_models() -> Dict[str, Dict[str, str]]:
    """
    Scan BASE_MODEL_DIR and return available models.

    Directory structure:
        models/
          <item>/
            padim/
              model.bin
              model.xml
            patchcore/
              model.bin
              model.xml

    Returns:
        {
          "pill": {
             "padim": "<full_path_to>/models/pill/padim/model",
             "patchcore": "<full_path_to>/models/pill/patchcore/model",
             "hybrid": "hybrid"
          },
          "transistor": {
             "patchcore": ".../models/transistor/patchcore/model"
          }
        }

    Only includes a base model if BOTH model.bin and model.xml exist.
    Only includes "hybrid" if BOTH padim and patchcore are valid for that item.
    """
    available: Dict[str, Dict[str, str]] = {}

    if not os.path.isdir(BASE_MODEL_DIR):
        return available  # no models folder yet

    for item_name in os.listdir(BASE_MODEL_DIR):
        item_path = os.path.join(BASE_MODEL_DIR, item_name)
        if not os.path.isdir(item_path):
            continue

        item_models: Dict[str, str] = {}

        # Check each base model type (padim, patchcore)
        for model_name in VALID_BASE_MODELS:
            model_dir = os.path.join(item_path, model_name)
            if not os.path.isdir(model_dir):
                continue

            bin_path = os.path.join(model_dir, "model.bin")
            xml_path = os.path.join(model_dir, "model.xml")

            # Only accept this model if both files exist
            if os.path.isfile(bin_path) and os.path.isfile(xml_path):
                # Store the *base path* without extension
                base_path = os.path.join(model_dir, "model")
                item_models[model_name] = base_path

        # If both padim and patchcore exist for this item, expose "hybrid"
        if "padim" in item_models and "patchcore" in item_models:
            item_models["hybrid"] = "hybrid"

        # Only include this item if at least one valid model
        if item_models:
            available[item_name] = item_models

    return available


def get_inferencer(item: str, model: str) -> OpenVINOInferencer:
    """
    Return a cached OpenVINOInferencer for (item, model).

    'model' here is a base model: 'padim' or 'patchcore'.
    'hybrid' is handled at the /analyze level, never here.
    """
    key = f"{item}:{model}"
    if key in CACHED_INFERENCERS:
        return CACHED_INFERENCERS[key]

    all_models = discover_models()

    if item not in all_models:
        raise HTTPException(status_code=400, detail=f"Item '{item}' not available")

    if model not in all_models[item] or model == "hybrid":
        raise HTTPException(status_code=400, detail=f"Model '{model}' not available for item '{item}'")

    base_path = all_models[item][model]
    bin_path = base_path + ".bin"

    # We already checked xml exists in discover_models; no need here
    inferencer = OpenVINOInferencer(
        path=bin_path,
        device="CPU",
        task="classification",   # using PaDiM/PatchCore as anomaly scorers
    )

    CACHED_INFERENCERS[key] = inferencer
    return inferencer


def get_score(pred) -> float:
    """
    Extract the anomaly score from anomalib prediction result.
    Assumes 'pred_score' in dict-like structure.
    """
    try:
        if isinstance(pred, dict):
            s = pred.get("pred_score", None)
        else:
            s = getattr(pred, "pred_score", None)
        return float(np.ravel(s)[0])
    except Exception:
        return 0.0


# ---------------------------------------------------------
# ROUTES
# ---------------------------------------------------------

@app.get("/health")
def health():
    return {"status": "running"}

@app.post("/models/unload")
def unload_models():
    """Release all OpenVINO locked files so delete works"""
    CACHED_INFERENCERS.clear()
    return {"status": "unloaded"}


@app.get("/models")
def list_models():
    """
    Returns discovered items and their available models.
    Used by frontend to build model selection UI.

    Example response:
    {
      "pill": {
        "padim": "X:/.../models/pill/padim/model",
        "patchcore": "X:/.../models/pill/patchcore/model",
        "hybrid": "hybrid"
      }
    }
    """
    return discover_models()


@app.post("/analyze")
async def analyze(
    file: UploadFile = File(...),
    item: str = Form(...),
    model: str = Form(...),
    threshold: float = Form(0.7),
):
    """
    Analyze a single image.

    Form fields:
      - file: image (jpeg/png)
      - item: e.g. "pill"
      - model: "padim", "patchcore", or "hybrid"
      - threshold: float

    Response:
      {
        "item": "pill",
        "model": "hybrid",
        "label": "NORMAL" | "ANOMALY",
        "score": 0.443,
        "threshold": 0.7
      }
    """
    models = discover_models()

    # Validate item and model
    if item not in models:
        raise HTTPException(status_code=400, detail=f"Item '{item}' not available")

    if model not in models[item]:
        raise HTTPException(
            status_code=400,
            detail=f"Model '{model}' not available for item '{item}'",
        )

    # Decode input image
    try:
        raw_bytes = await file.read()
        img = Image.open(BytesIO(raw_bytes)).convert("RGB")
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid image file")

    # Compute score
    if model == "hybrid":
        pad_inf = get_inferencer(item, "padim")
        pcore_inf = get_inferencer(item, "patchcore")

        pad_pred = pad_inf.predict(image=img)
        pcore_pred = pcore_inf.predict(image=img)

        score = (get_score(pad_pred) + get_score(pcore_pred)) / 2.0
    else:
        inf = get_inferencer(item, model)
        pred = inf.predict(image=img)
        score = get_score(pred)

    label = "ANOMALY" if score > threshold else "NORMAL"

    return {
        "item": item,
        "model": model,
        "label": label,
        "score": round(float(score), 3),
        "threshold": float(threshold),
    }
