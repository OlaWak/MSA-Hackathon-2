import cv2

cap = cv2.VideoCapture(0)

if not cap.isOpened():
    print("ERROR: Could not open camera at index 0.")
    raise SystemExit(1)

ret, frame = cap.read()
cap.release()

if not ret:
    print("ERROR: Could not read frame.")
    raise SystemExit(1)

out_path = "camera_test.jpg"
cv2.imwrite(out_path, frame)
print(f"Saved {out_path}")
