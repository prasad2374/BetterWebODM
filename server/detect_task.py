import os
import sys
import argparse
import requests
import json
import rasterio
import numpy as np
from ultralytics import YOLO
from dotenv import load_dotenv
from rasterio.windows import Window
from dotenv import load_dotenv

# explicitly load from current dir (server/)
env_path = os.path.join(os.path.dirname(__file__), '.env')
load_dotenv(env_path)

isDev = sys.argv.count("--dev") > 0
if isDev:
    sys.argv.remove("--dev")
WEBODM_URL = f"http://{"localhost" if isDev  else  os.getenv('WEBODM_ADDR', 'localhost')}:{os.getenv('WEBODM_PORT', '8000')}"
USERNAME = os.getenv('WEBODM_USER', 'admin')  # Changed from WEBODM_USERNAME
PASSWORD = os.getenv('WEBODM_PASS', 'admin')  # Changed from WEBODM_PASSWORD

# Debug Env
print(f"Loaded Env from: {env_path}", file=sys.stderr)
print(f"User: {USERNAME}, Pass: {'****' if PASSWORD else 'None'}", file=sys.stderr)

def get_auth_headers():
    try:
        res = requests.post(f"{WEBODM_URL}/api/token-auth/", data={'username': USERNAME, 'password': PASSWORD})
        if res.status_code == 200:
            return {'Authorization': f"JWT {res.json()['token']}"}
    except Exception as e:
        print(f"Auth Error: {e}", file=sys.stderr)
    return {}

def download_file(url, local_filename, headers):
    with requests.get(url, headers=headers, stream=True) as r:
        r.raise_for_status()
        with open(local_filename, 'wb') as f:
            for chunk in r.iter_content(chunk_size=8192):
                f.write(chunk)
    return local_filename

def compute_iou(boxA, boxB):
    # Determine the (x, y)-coordinates of the intersection rectangle
    xA = max(boxA[0], boxB[0])
    yA = max(boxA[1], boxB[1])
    xB = min(boxA[2], boxB[2])
    yB = min(boxA[3], boxB[3])

    # Compute the area of intersection rectangle
    interWidth = max(0, xB - xA)
    interHeight = max(0, yB - yA)
    interArea = interWidth * interHeight

    if interArea == 0:
        return 0

    # Compute the area of both the prediction and ground-truth rectangles
    boxAArea = (boxA[2] - boxA[0]) * (boxA[3] - boxA[1])
    boxBArea = (boxB[2] - boxB[0]) * (boxB[3] - boxB[1])

    # Compute the intersection over union
    iou = interArea / float(boxAArea + boxBArea - interArea)
    return iou

def apply_hybrid_filter(candidates, iou_thresh=0.5):
    """
    Hybrid deduplication:
    1. STRICT CONTAINMENT (User Request): If A is inside B, remove A.
    2. NMS (Standard): If A overlaps B significantly (IoU > thresh), remove lower conf.
    """
    if not candidates:
        return []

    # Sort by confidence descending (crucial for NMS)
    candidates = sorted(candidates, key=lambda x: x['conf'], reverse=True)

    n = len(candidates)
    keep = [True] * n

    for i in range(n):
        if not keep[i]: continue

        boxA = candidates[i]['bbox']

        for j in range(i + 1, n): # Compare with subsequent (lower conf or same)
            if not keep[j]: continue

            # We only filter if same class (usually)
            # If user wants to remove 'Tank' inside 'Vehicle', we need to relax this.
            # Assuming same class for 'Double Bounding Box' error.
            if candidates[i]['cls'] != candidates[j]['cls']:
                continue

            boxB = candidates[j]['bbox']

            # Check 1: Containment
            # Check if B is inside A (Since i is current/higher conf kept, we usually keep i)
            # OR Check if A is inside B (Shouldn't happen if sorted by conf?
            # Actually conf doesn't dictate size. Small high-conf box vs Large low-conf box)

            # Let's check mutual containment or overlap

            # Is B inside A?
            b_in_a = (boxB[0] >= boxA[0] and boxB[1] >= boxA[1] and boxB[2] <= boxA[2] and boxB[3] <= boxA[3])

            # Is A inside B?
            a_in_b = (boxA[0] >= boxB[0] and boxA[1] >= boxB[1] and boxA[2] <= boxB[2] and boxA[3] <= boxB[3])

            if b_in_a or a_in_b:
                # Containment detected. Remove the contained one?
                # Usually we keep the one with higher confidence (A).
                # But if the User wants "Small box inside Large box removed", we might remove the *inner* one regardless of confidence?
                # User prompted: "remove the bounding box that is inside"
                # If A is inside B, remove A.
                # If B is inside A, remove B.

                if b_in_a:
                    print(f"[DEBUG] Box {j} inside {i}. Removing {j} (Containment)", file=sys.stderr)
                    keep[j] = False
                    continue

                if a_in_b:
                    print(f"[DEBUG] Box {i} inside {j}. Removing {i} (Containment)", file=sys.stderr)
                    keep[i] = False
                    break # Stop processing A

            # Check 2: IoU (Overlap)
            iou = compute_iou(boxA, boxB)
            if iou > iou_thresh:
                 # Remove B (since it has lower/equal confidence)
                 print(f"[DEBUG] Box {j} overlaps {i} (IoU={iou:.2f}). Removing {j} (NMS)", file=sys.stderr)
                 keep[j] = False

    return [candidates[i] for i in range(n) if keep[i]]

def run_inference(tif_path, model_path, tile_size=1280, overlap=0):
    print("MODEL PATH", model_path)
    model = YOLO(model_path)
    global_candidates = [] # Store all detections here before NMS

    # Prepare CRS Transformer (Projected -> Lat/Lon)
    from pyproj import Transformer

    with rasterio.open(tif_path) as src:
        width = src.width
        height = src.height
        transform = src.transform
        src_crs = src.crs

        # Create transformer to EPSG:4326 (Lat/Lon)
        # Always allow_ballpark=True for approximate if grid missing
        transformer = Transformer.from_crs(src_crs, "EPSG:4326", always_xy=True)

        step = int(tile_size * (1 - overlap))

        for y in range(0, height, step):
            for x in range(0, width, step):
                # Define Window
                w = min(tile_size, width - x)
                h = min(tile_size, height - y)
                window = Window(x, y, w, h)

                # Check for empty window/nodata
                img = src.read(window=window) # (Channels, H, W)
                img = np.moveaxis(img, 0, -1) # (H, W, Channels)

                # Use only RGB (drop Alpha if exists)
                if img.shape[2] > 3:
                    img = img[:, :, :3]

                # Run Inference
                results = model.predict(img, verbose=False, conf=0.25)

                for r in results:
                    for box in r.boxes:
                        # Local Coords
                        bx1, by1, bx2, by2 = box.xyxy[0].tolist()
                        cls = int(box.cls[0])
                        conf = float(box.conf[0])
                        label = model.names[cls]

                        # Global Pixel Coords
                        gx1 = x + bx1
                        gy1 = y + by1
                        gx2 = x + bx2
                        gy2 = y + by2

                        # Store Candidate
                        global_candidates.append({
                            'bbox': [gx1, gy1, gx2, gy2], # Global Pixel Box
                            'local_bbox': [bx1, by1, bx2, by2], # Local for cropping
                            'tile_offset': (x, y),
                            'cls': cls,
                            'label': label,
                            'conf': conf,
                            'start_img': img # Reference to tile image for cropping later (Careful with memory? Tile loop implies img changes. Need to copy or crop now?)
                        })
                        # IMPORTANT: storing 'img' reference is bad because loop continues.
                        # We must extract crop NOW or store copy. Storing full tile copy is memory heavy.
                        # Strategy: Extract crop NOW, store b64 (or raw), then NMS.

                        # Extract Crop Immediately
                        ibx1, iby1, ibx2, iby2 = int(bx1), int(by1), int(bx2), int(by2)
                        ibx1, iby1 = max(0, ibx1), max(0, iby1)
                        ibx2, iby2 = min(img.shape[1], ibx2), min(img.shape[0], iby2)

                        crop_b64 = None
                        if ibx2 > ibx1 and iby2 > iby1:
                            import cv2
                            import base64
                            crop = img[iby1:iby2, ibx1:ibx2]
                            try:
                                crop_bgr = cv2.cvtColor(crop, cv2.COLOR_RGB2BGR)
                                ret, buf = cv2.imencode('.jpg', crop_bgr)
                                if ret:
                                    crop_b64 = base64.b64encode(buf).decode('utf-8')
                            except: pass

                        global_candidates[-1]['image'] = crop_b64
                        del global_candidates[-1]['start_img'] # Remove ref

    print(f"[DEBUG] Total candidates before Hybrid Filter: {len(global_candidates)}", file=sys.stderr)

    # --- APPLY HYBRID FILTER (Containment + NMS) ---
    final_candidates = apply_hybrid_filter(global_candidates, iou_thresh=0.5)

    print(f"[DEBUG] Total candidates after Hybrid Filter: {len(final_candidates)}", file=sys.stderr)

    features = []
    for c in final_candidates:
        gx1, gy1, gx2, gy2 = c['bbox']

        # 1. Pixel -> Projected (using Rasterio transform)
        # Affine * (col, row) -> (x, y)
        px1, py1 = transform * (gx1, gy1)
        px2, py2 = transform * (gx2, gy1)
        px3, py3 = transform * (gx2, gy2)
        px4, py4 = transform * (gx1, gy2)

        # 2. Projected -> Lat/Lon (using PyProj)
        lon1, lat1 = transformer.transform(px1, py1)
        lon2, lat2 = transformer.transform(px2, py2)
        lon3, lat3 = transformer.transform(px3, py3)
        lon4, lat4 = transformer.transform(px4, py4)

        # Calculate Centroid
        c_lon = (lon1 + lon2 + lon3 + lon4) / 4.0
        c_lat = (lat1 + lat2 + lat3 + lat4) / 4.0

        feature = {
            "type": "Feature",
            "properties": {
                "label": c['label'],
                "confidence": c['conf'],
                "image": c['image'],
                "centroid": [c_lat, c_lon]
            },
            "geometry": {
                "type": "Polygon",
                "coordinates": [[
                    [lon1, lat1],
                    [lon2, lat2],
                    [lon3, lat3],
                    [lon4, lat4],
                    [lon1, lat1]
                ]]
            }
        }
        features.append(feature)

    return {
        "type": "FeatureCollection",
        "model_classes": model.names,
        "features": features
    }

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument('--task_id', required=True)
    parser.add_argument('--project_id', required=True)
    parser.add_argument('--model', default='')
    # parser.add_argument('--model', default='PyTorch')
    args = parser.parse_args()

    # Setup paths
    temp_tif = f"temp_{args.task_id}.tif"

    try:
        print("Starting detect_task.py...", file=sys.stderr)
        headers = get_auth_headers()
        print(f"Auth Headers obtained: {bool(headers)}", file=sys.stderr)

        # Determine Download URL (Use /download/ format verified earlier)
        url = f"{WEBODM_URL}/api/projects/{args.project_id}/tasks/{args.task_id}/download/orthophoto.tif"
        print(f"Downloading from: {url}", file=sys.stderr)
        # print(f"TEST", args)

        download_file(url, temp_tif, headers)
        print(f"Download complete. File size: {os.path.getsize(temp_tif)} bytes", file=sys.stderr)

        print(f"Running Inference on {temp_tif} with model {args.model}...", file=sys.stderr)
        geojson = run_inference(temp_tif, f"yolomodels/{args.model}")

        print("Inference complete. Dumping JSON...", file=sys.stderr)
        print(json.dumps(geojson))

    except Exception as e:
        print(f"CRITICAL PYTHON ERROR: {e}", file=sys.stderr)
        # print(json.dumps({"error": str(e)})) # Don't mix stdout with error if possible
        sys.exit(1)
    finally:
        if os.path.exists(temp_tif):
            os.remove(temp_tif)
