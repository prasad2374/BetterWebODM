import argparse
import json
import sys
import os
import cv2
import exifread
import statistics
from ultralytics import YOLO
import numpy as np

# Camera Specifications
CAMERA_SPECS = {
    4656: {'name': 'Arducam 16MP (IMX298)', 'sensor_w_mm': 5.21, 'focal_mm': 3.43},
    3280: {'name': 'Arducam 8MP (IMX219)', 'sensor_w_mm': 3.67, 'focal_mm': 2.96},
    4096: {'name': 'Siyi A8 Mini (8MP 4K)', 'sensor_w_mm': 7.60, 'focal_mm': 4.5},
    1920: {'name': 'Arducam 16MP (1080p Crop)', 'sensor_w_mm': 5.21, 'focal_mm': 5.87}
}

def get_exif_data(image_path):
    with open(image_path, 'rb') as f:
        tags = exifread.process_file(f, details=False)

    focal_length = None
    altitude = None

    if 'EXIF FocalLength' in tags:
        vals = tags['EXIF FocalLength'].values
        if vals:
             val = vals[0] if isinstance(vals, list) else vals
             if hasattr(val, 'num'): 
                 focal_length = float(val.num) / float(val.den)
             elif isinstance(val, (int, float)):
                 focal_length = float(val)

    if 'GPS GPSAltitude' in tags:
        vals = tags['GPS GPSAltitude'].values
        if vals:
            val = vals[0] if isinstance(vals, list) else vals
            if hasattr(val, 'num') and hasattr(val, 'den') and val.den != 0:
                altitude = float(val.num) / float(val.den)
            elif isinstance(val, (int, float)):
                 altitude = float(val)
            
    return focal_length, altitude

def calculate_gsd(sensor_w_mm, altitude_m, focal_mm, image_w_px):
    if any(param is None for param in [sensor_w_mm, altitude_m, focal_mm, image_w_px]):
        return None
    if focal_mm == 0 or image_w_px == 0:
        return None
    gsd_cm_px = (sensor_w_mm * altitude_m * 100) / (focal_mm * image_w_px)
    return gsd_cm_px

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--dir', required=True, help='Directory containing images')
    parser.add_argument('--model', required=True, help='Path to YOLO model')
    args = parser.parse_args()

    if not os.path.exists(args.dir):
        print(json.dumps({"error": "Directory not found"}))
        sys.exit(1)

    try:
        model = YOLO(args.model)
        
        image_files = [f for f in os.listdir(args.dir) if f.lower().endswith(('.jpg', '.jpeg', '.png'))]
        if not image_files:
            print(json.dumps({"error": "No images found"}))
            return

        results = []

        for img_name in image_files:
            img_path = os.path.join(args.dir, img_name)
            img = cv2.imread(img_path)
            if img is None: continue
            h, w = img.shape[:2]
            
            focal, alt = get_exif_data(img_path)
            
            cam_spec = None
            for expected_w, spec in CAMERA_SPECS.items():
                if abs(w - expected_w) < 50:
                    cam_spec = spec
                    break
            
            if cam_spec:
                sensor_w = cam_spec['sensor_w_mm']
                default_focal = cam_spec['focal_mm']
                cam_name = cam_spec['name']
            else:
                sensor_w = 6.3 
                default_focal = 5.87
                cam_name = "Unknown Camera"

            calc_focal = focal if focal else default_focal
            gsd = calculate_gsd(sensor_w, alt, calc_focal, w)
            
            inference_results = model(img_path, verbose=False)
            
            det_count = 0
            conf_scores = []
            for r in inference_results:
                boxes = r.boxes
                det_count += len(boxes)
                if len(boxes) > 0:
                    conf_scores.extend(boxes.conf.cpu().numpy())
            
            avg_conf = float(statistics.mean(conf_scores)) if conf_scores else 0.0
            
            results.append({
                "name": img_name,
                "focal": focal,
                "alt": alt,
                "gsd": gsd,
                "detections": det_count,
                "avg_conf": avg_conf,
                "camera": cam_name
            })

        if not results:
            print(json.dumps({"error": "No results processed"}))
            return

        # Sort: Detections Desc, then Conf Desc
        best_result = sorted(results, key=lambda x: (x['detections'], x['avg_conf']), reverse=True)[0]
        
        display_focal = best_result['focal'] if best_result['focal'] else 7.1 # Fallback from original script?
        
        recommendations = []
        if best_result['gsd']:
             for w_key, spec in CAMERA_SPECS.items():
                f_mm = spec['focal_mm']
                s_mm = spec['sensor_w_mm']
                opt_height = (best_result['gsd'] * f_mm * w_key) / (s_mm * 100)
                recommendations.append({
                    "camera": spec['name'],
                    "opt_height": round(opt_height, 2)
                })

        output = {
            "results": results,
            "best_config": {
                "image": best_result['name'],
                "focal_mm": best_result['focal'],
                "alt_m": best_result['alt'],
                "gsd": best_result['gsd'],
                "detections": best_result['detections'],
                "avg_conf": best_result['avg_conf']
            },
            "recommendations": recommendations
        }
        
        print(json.dumps(output))

    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)

if __name__ == "__main__":
    main()
