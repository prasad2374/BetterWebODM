import math
from pyproj import Transformer

def pixel_to_geo(
    lat, lon, alt,
    px, py,
    img_w, img_h,
    focal_mm,
    sensor_w_mm,
    yaw_deg
):
    """
    Converts pixel location to GPS coordinate using camera model
    """

    # Camera parameters
    fx = (focal_mm / sensor_w_mm) * img_w
    cx, cy = img_w / 2, img_h / 2

    # Normalize pixel
    x = (px - cx) / fx
    y = (py - cy) / fx

    # Ground projection
    east = x * alt
    north = -y * alt

    # Rotate by yaw
    yaw = math.radians(yaw_deg)
    e = east * math.cos(yaw) - north * math.sin(yaw)
    n = east * math.sin(yaw) + north * math.cos(yaw)

    # Convert to lat/lon
    t = Transformer.from_crs("epsg:4326", "epsg:3857", always_xy=True)
    x0, y0 = t.transform(lon, lat)

    x0 += e
    y0 += n

    t_back = Transformer.from_crs("epsg:3857", "epsg:4326", always_xy=True)
    lon2, lat2 = t_back.transform(x0, y0)

    return lat2, lon2