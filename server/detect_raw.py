import os
import sys
import argparse
import json
import cv2
import exifread
import math
import numpy as np
from ultralytics import YOLO
# Import user provided function from parent dir or same dir
# server/detect_raw.py -> ../localization.py? 
# The user said they added localization.py to CustomApp root?
# Let's fix import path.
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
try:
    from localization import pixel_to_geo
except ImportError:
    # Fallback if in same dir
    from localization import pixel_to_geo

DEFAULT_SENSOR_W = 6.17  # 1/2.3"
DEFAULT_FOCAL = 24.0     # 24mm equiv? Needs checking.

def get_exif_data(image_path):
    with open(image_path, 'rb') as f:
        tags = exifread.process_file(f)
        
    data = {}
    
    def get_float(tag):
        if tag in tags:
            val = tags[tag].values
            if isinstance(val, list):
                val = val[0]
            if isinstance(val, int):
                return float(val)
            if hasattr(val, 'num') and hasattr(val, 'den') and val.den != 0:
                return float(val.num) / float(val.den)
        return None
        
    def convert_dms(dms_ratios):
        d = float(dms_ratios[0].num) / float(dms_ratios[0].den)
        m = float(dms_ratios[1].num) / float(dms_ratios[1].den)
        s = float(dms_ratios[2].num) / float(dms_ratios[2].den)
        return d + (m / 60.0) + (s / 3600.0)

    # Coordinates
    if 'GPS GPSLatitude' in tags:
        lat = convert_dms(tags['GPS GPSLatitude'].values)
        if 'GPS GPSLatitudeRef' in tags and tags['GPS GPSLatitudeRef'].values == 'S': 
            lat = -lat
        data['lat'] = lat
        
    if 'GPS GPSLongitude' in tags:
        lon = convert_dms(tags['GPS GPSLongitude'].values)
        if 'GPS GPSLongitudeRef' in tags and tags['GPS GPSLongitudeRef'].values == 'W': 
            lon = -lon
        data['lon'] = lon
        
    # Altitude
    alt = get_float('GPS GPSAltitude')
    if alt is not None:
        data['alt'] = alt
    else:
        data['alt'] = 50.0 # Default relative height

    # Yaw / Heading
    # Try different tags
    yaw = get_float('GPS GPSImgDirection')
    if yaw is None:
        yaw = 0.0
    data['yaw'] = yaw
    
    # Focal Length
    focal = get_float('EXIF FocalLength')
    if focal is None:
        focal = DEFAULT_FOCAL
    data['focal'] = focal
    
    return data

def run_detection_raw(image_paths, model_path):
    # Load model
    try:
        model = YOLO(model_path)
    except Exception as e:
        print(f"Error loading model {model_path}: {e}", file=sys.stderr)
        return {"type": "FeatureCollection", "features": []}

    features = []
    
    for img_path in image_paths:
        if not os.path.exists(img_path):
            continue
            
        try:
            # 1. Get Metadata
            meta = get_exif_data(img_path)
            if 'lat' not in meta or 'lon' not in meta:
                continue # Cannot localize without GPS

            # 2. Read Image
            img = cv2.imread(img_path)
            if img is None:
                continue
            h, w = img.shape[:2]

            # 3. Predict
            results = model.predict(img, verbose=False, conf=0.25)
            
            # --- FILTERING LOGIC START ---
            all_boxes = []
            for r in results:
                for box in r.boxes:
                     # xyxy format: x1, y1, x2, y2
                    b = box.xyxy[0].tolist()
                    all_boxes.append({
                        'box': b,
                        'obj': box
                    })

            # Check for containment
            # A box is kept if it is NOT completely inside any other box
            valid_boxes = []
            for i, item_a in enumerate(all_boxes):
                is_inside = False
                ax1, ay1, ax2, ay2 = item_a['box']
                
                for j, item_b in enumerate(all_boxes):
                    if i == j: continue
                    bx1, by1, bx2, by2 = item_b['box']
                    
                    # Check if A is inside B
                    # We might want strict inequality or not. Usually strict on at least one side prevents
                    # identical boxes from deleting each other (mutual containment).
                    # But if identical, we probably want to keep one. 
                    # Let's say: if A is inside B, eliminate A.
                    # Handle exact duplicates: eliminate if i > j (keep first occurrence)
                    
                    if ax1 >= bx1 and ay1 >= by1 and ax2 <= bx2 and ay2 <= by2:
                        # A is inside B
                        # Check for exact equality to avoid deleting both or keeping duplicates
                        if ax1 == bx1 and ay1 == by1 and ax2 == bx2 and ay2 == by2:
                             if i > j: 
                                 is_inside = True
                                 break
                        else:
                            is_inside = True
                            break
                            
                if not is_inside:
                    valid_boxes.append(item_a['obj'])
            
            # --- FILTERING LOGIC END ---

            for box in valid_boxes:
                # Bounding Box Center
                bx1, by1, bx2, by2 = box.xyxy[0].tolist()
                cx = (bx1 + bx2) / 2
                cy = (by1 + by2) / 2
                
                label = model.names[int(box.cls[0])]
                conf = float(box.conf[0])
                
                # 4. Localize
                # pixel_to_geo(lat, lon, alt, px, py, img_w, img_h, focal_mm, sensor_w_mm, yaw_deg)
                # We assume sensor_w_mm is constant for the drone corpus unless specified
                try:
                    obj_lat, obj_lon = pixel_to_geo(
                        meta['lat'], meta['lon'], meta['alt'],
                        cx, cy,
                        w, h,
                        meta['focal'],
                        DEFAULT_SENSOR_W,
                        meta['yaw']
                    )
                    
                    feature = {
                        "type": "Feature",
                        "properties": {
                            "label": label,
                            "confidence": conf,
                            "source": os.path.basename(img_path)
                        },
                        "geometry": {
                            "type": "Point",
                            "coordinates": [obj_lon, obj_lat]
                        }
                    }
                    features.append(feature)
                except Exception as loc_e:
                    print(f"Localization Calc Error: {loc_e}", file=sys.stderr)

        except Exception as e:
            print(f"Error processing {img_path}: {e}", file=sys.stderr)
            continue

    return {
        "type": "FeatureCollection",
        "features": features
    }

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument('--images', nargs='+', required=True) # List of image paths
    parser.add_argument('--model', default='../best.pt')
    args = parser.parse_args()
    
    # print(f"Processing {len(args.images)} images...", file=sys.stderr)
    
    geojson = run_detection_raw(args.images, args.model)
    print(json.dumps(geojson))
