import argparse
import json
import sys

# Camera Specifications
CAMERA_SPECS = {
    4656: {'name': 'Arducam 16MP (IMX298)', 'sensor_w_mm': 5.21, 'focal_mm': 3.43},
    3280: {'name': 'Arducam 8MP (IMX219)', 'sensor_w_mm': 3.67, 'focal_mm': 2.96},
    4096: {'name': 'Siyi A8 Mini (8MP 4K)', 'sensor_w_mm': 7.60, 'focal_mm': 4.5},
    1920: {'name': 'Arducam 16MP (1080p Crop)', 'sensor_w_mm': 5.21, 'focal_mm': 5.87}
}

def calculate_height(target_gsd_cm_px):
    results = []
    
    for width_px, spec in CAMERA_SPECS.items():
        focal = spec['focal_mm']
        sensor = spec['sensor_w_mm']
        name = spec['name']

        # GSD (cm/px) = (SensorWidth_mm * Height_m * 100) / (Focal_mm * ImageWidth_px)
        # Height_m = (GSD * Focal * ImageWidth) / (SensorWidth * 100)
        
        height_m = (target_gsd_cm_px * focal * width_px) / (sensor * 100)
        
        results.append({
            "camera_name": name,
            "optimum_height_m": round(height_m, 2),
            "focal_length_mm": focal,
            "sensor_width_mm": sensor,
            "image_width_px": width_px
        })

    return results

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument('--gsd', type=float, required=True, help='Target GSD in cm/pixel')
    args = parser.parse_args()

    try:
        data = calculate_height(args.gsd)
        print(json.dumps(data))
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)
