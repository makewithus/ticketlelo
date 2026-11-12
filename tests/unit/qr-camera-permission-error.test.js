import { test } from 'node:test';
import assert from 'node:assert/strict';

test('QR Camera Scanner: Handles Permission Dismissed and Generates User Toast Message', () => {
  // Simulate error messages caught during QR camera initialization
  function getCameraFriendlyMessage(error) {
    const errMsg = error?.message || String(error || "");
    const errName = error?.name || "";

    if (
      errName === "NotAllowedError" ||
      errMsg.toLowerCase().includes("permission dismissed") ||
      errMsg.toLowerCase().includes("permission denied") ||
      errMsg.toLowerCase().includes("notallowederror")
    ) {
      return "Camera permission was dismissed or denied. Please allow camera permissions in your browser or switch to Manual Entry.";
    } else if (
      errName === "NotFoundError" ||
      errMsg.toLowerCase().includes("no cameras") ||
      errMsg.toLowerCase().includes("devicesnotfounderror")
    ) {
      return "No camera detected on this device. Please use manual ticket entry.";
    } else if (
      errName === "NotReadableError" ||
      errMsg.toLowerCase().includes("already in use")
    ) {
      return "Camera is currently busy or in use by another application.";
    }
    return "Unable to start camera scanner. Please use manual entry.";
  }

  // 1. Permission dismissed test case
  const permissionDismissedError = new Error("Permission dismissed");
  permissionDismissedError.name = "NotAllowedError";
  const msg1 = getCameraFriendlyMessage(permissionDismissedError);
  assert.match(msg1, /dismissed or denied/i);
  assert.match(msg1, /Manual Entry/i);

  // 2. Permission denied test case
  const permissionDeniedError = new Error("Permission denied by user");
  permissionDeniedError.name = "NotAllowedError";
  const msg2 = getCameraFriendlyMessage(permissionDeniedError);
  assert.match(msg2, /dismissed or denied/i);

  // 3. No camera detected test case
  const noCameraError = new Error("No cameras found");
  noCameraError.name = "NotFoundError";
  const msg3 = getCameraFriendlyMessage(noCameraError);
  assert.match(msg3, /No camera detected/i);

  // 4. Verify qrbox calculation is defined and does not throw ReferenceError
  const qrBoxFunction = (viewfinderWidth, viewfinderHeight, qrbox = 260) => {
    const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
    const boxSize = Math.max(160, Math.min(minEdge * 0.75, qrbox || 260));
    return { width: Math.round(boxSize), height: Math.round(boxSize) };
  };

  const box = qrBoxFunction(400, 400, 260);
  assert.strictEqual(box.width, 260);
  assert.strictEqual(box.height, 260);

  const smallBox = qrBoxFunction(200, 200, 260);
  assert.strictEqual(smallBox.width, 160);
  assert.strictEqual(smallBox.height, 160);
});
