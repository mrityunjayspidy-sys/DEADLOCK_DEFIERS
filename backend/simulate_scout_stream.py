"""
Simulated Field Scout Stream Transmitter for SentryWing.
Connects to /ws/stream as a simulated Ranger/Drone in the field,
generating continuous video frames of wildlife and streaming them
to the SentryWing backend at 12-15 FPS.

This immediately activates the FOREST OFFICER LIVE SENTRY STREAM
and VET PATROL STREAM in real time.
"""

import asyncio
import cv2
import json
import math
import numpy as np
import time
import websockets

BACKEND_WS_URL = "ws://127.0.0.1:8000/ws/stream"

def create_synthetic_frame(frame_idx: int, width: int = 640, height: int = 480) -> np.ndarray:
    """Generates a realistic field camera frame with moving wildlife targets."""
    frame = np.zeros((height, width, 3), dtype=np.uint8)

    # Gradient background (dense foliage / night forest / grassland)
    for y in range(height):
        g = int(35 + 25 * (y / height))
        r = int(20 + 15 * (y / height))
        b = int(25 + 20 * (y / height))
        frame[y, :] = [b, g, r]

    # Grid overlay lines (infrared / night vision camera look)
    grid_spacing = 60
    for x in range(0, width, grid_spacing):
        cv2.line(frame, (x, 0), (x, height), (35, 55, 35), 1)
    for y in range(0, height, grid_spacing):
        cv2.line(frame, (0, y), (width, y), (35, 55, 35), 1)

    # Simulated moving animal (e.g. Tiger / Elephant centroid oscillation)
    t = frame_idx * 0.05
    cx = int(width * 0.5 + math.sin(t) * (width * 0.28))
    cy = int(height * 0.5 + math.cos(t * 0.7) * (height * 0.18))
    box_w = 110
    box_h = 75

    x1 = max(10, cx - box_w // 2)
    y1 = max(10, cy - box_h // 2)
    x2 = min(width - 10, cx + box_w // 2)
    y2 = min(height - 10, cy + box_h // 2)

    # Draw animal silhouette / shape
    cv2.ellipse(frame, (cx, cy), (box_w // 2, box_h // 2), 0, 0, 360, (70, 110, 85), -1)
    cv2.circle(frame, (cx + 35, cy - 15), 22, (75, 115, 90), -1)

    # Tactical HUD Stamp
    time_str = time.strftime("%Y-%m-%d %H:%M:%S UTC", time.gmtime())
    cv2.putText(frame, f"[PATROL UNIT 04] // {time_str}", (15, 25),
                cv2.FONT_HERSHEY_SIMPLEX, 0.5, (200, 220, 200), 1, cv2.LINE_AA)
    cv2.putText(frame, "SECTOR 4 - CORBETT RESERVE // CAM-02 IR NIGHTSTREAM", (15, 45),
                cv2.FONT_HERSHEY_SIMPLEX, 0.45, (160, 190, 160), 1, cv2.LINE_AA)
    cv2.putText(frame, f"FRAME: {frame_idx:06d} // 15.0 FPS", (15, height - 15),
                cv2.FONT_HERSHEY_SIMPLEX, 0.45, (180, 200, 180), 1, cv2.LINE_AA)

    return frame


async def run_scout_simulator():
    print("=" * 70)
    print("SENTRYWING FIELD SCOUT SIMULATOR")
    print(f"Connecting to live video receiver: {BACKEND_WS_URL}")
    print("=" * 70)

    while True:
        try:
            async with websockets.connect(BACKEND_WS_URL) as ws:
                print("[OK] Connected to /ws/stream! Initializing patrol session...")

                # 1. Initialize Scout Session
                session_payload = {
                    "type": "init_session",
                    "uploader_id": "scout_corbett_04",
                    "uploader_name": "Ranger Arjun (Sector 4)",
                    "location": {
                        "lat": 29.5312,
                        "lng": 78.7744,
                        "name": "Jim Corbett National Park, Sector 4 Outpost"
                    }
                }
                await ws.send(json.dumps(session_payload))
                ack = await ws.recv()
                print(f"[OK] Session Initialized: {ack}")

                # Enable feed publisher
                await ws.send(json.dumps({"type": "set_publish_mode", "enabled": True}))

                frame_idx = 0
                print("\n--> Pushing continuous live video frames (15 FPS)...")
                print("--> Open the FOREST OFFICER LIVE SENTRY STREAM to watch live video!\n")

                while True:
                    start_time = time.time()
                    frame = create_synthetic_frame(frame_idx)
                    frame_idx += 1

                    # Encode to JPEG
                    _, buffer = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 80])
                    frame_bytes = buffer.tobytes()

                    # Send binary frame to /ws/stream
                    await ws.send(frame_bytes)

                    # Listen for telemetry response from backend
                    try:
                        resp = await asyncio.wait_for(ws.recv(), timeout=0.1)
                    except asyncio.TimeoutError:
                        pass

                    elapsed = time.time() - start_time
                    delay = max(0.01, (1.0 / 15.0) - elapsed)
                    await asyncio.sleep(delay)

                    if frame_idx % 45 == 0:
                        print(f"  [STREAMING] Frame {frame_idx} transmitted (15 FPS, Corbett Sector 4)")

        except (websockets.exceptions.ConnectionClosed, ConnectionRefusedError) as e:
            print(f"[WARNING] Stream connection dropped: {e}. Reconnecting in 3s...")
            await asyncio.sleep(3)
        except Exception as e:
            print(f"[ERROR] Simulator error: {e}. Reconnecting in 3s...")
            await asyncio.sleep(3)


if __name__ == "__main__":
    asyncio.run(run_scout_simulator())
