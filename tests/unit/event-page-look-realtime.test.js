import { test } from 'node:test';
import assert from 'node:assert/strict';
import { COLOR_SWATCHES, getThemeLook, getPosterLines } from '../../lib/theme-utils.js';

test('Event Page Look: Real-time Theme Colors & Banner Gradient Mapping', () => {
  // 1. Verify 6 canonical swatches exist
  assert.strictEqual(COLOR_SWATCHES.length, 6);
  assert.deepStrictEqual(
    COLOR_SWATCHES.map((s) => s.id),
    ['orange', 'yellow', 'blue', 'pink', 'green', 'white']
  );

  // 2. Verify Blue (#3B82F6) look updates in real time
  const blueLook = getThemeLook('#3B82F6');
  assert.strictEqual(blueLook.id, 'blue');
  assert.strictEqual(blueLook.hex, '#3B82F6');
  assert.match(blueLook.gradientCss, /#1D4ED8|#1E40AF/);
  assert.strictEqual(blueLook.sun, '#38BDF8');
  assert.strictEqual(blueLook.textColor, '#FFFFFF');
  assert.strictEqual(blueLook.buttonTextColor, '#FFFFFF');

  // 3. Verify Yellow (#FDE003) look has high contrast dark text
  const yellowLook = getThemeLook('#FDE003');
  assert.strictEqual(yellowLook.id, 'yellow');
  assert.strictEqual(yellowLook.textColor, '#131517');
  assert.strictEqual(yellowLook.buttonTextColor, '#000000');

  // 4. Verify Custom Hex Code dynamically resolves gradient & sun
  const customLook = getThemeLook('#8B5CF6'); // Purple
  assert.strictEqual(customLook.hex, '#8B5CF6');
  assert.match(customLook.gradientCss, /linear-gradient/);

  // 5. Verify Word-aware poster headline splitting
  const lines1 = getPosterLines("Tech Fest 2026");
  assert.strictEqual(lines1.line1, "TECH");
  assert.strictEqual(lines1.line2, "FEST 2026");

  const lines2 = getPosterLines("Robotics Expo");
  assert.strictEqual(lines2.line1, "ROBOTICS");
  assert.strictEqual(lines2.line2, "EXPO");

  const linesCustom = getPosterLines("Tech Fest", "custom", "Hackathon", "Night");
  assert.strictEqual(linesCustom.line1, "HACKATHON");
  assert.strictEqual(linesCustom.line2, "NIGHT");
});
