import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { COLOR_SWATCHES, getThemeLook, getPosterLines, getReadableAccentColor, getReadableButtonTextColor } from '../../lib/theme-utils.js';

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

test('Event Page Look: WCAG Contrast & Legibility Guarantees on Any Theme Accent', () => {
  // 1. Deep purple (#4C1D95) gets boosted in dark mode so it's not invisible black-on-black
  const boostedPurple = getReadableAccentColor('#4C1D95', true);
  assert.notStrictEqual(boostedPurple.toLowerCase(), '#4c1d95');
  assert.match(boostedPurple, /^#[0-9a-f]{6}$/i);

  // 2. Yellow (#FDE003) retains vibrant tone and returns #000000 for button text
  const yellowAccent = getReadableAccentColor('#FDE003', true);
  assert.strictEqual(yellowAccent.toLowerCase(), '#fde003');
  assert.strictEqual(getReadableButtonTextColor('#FDE003'), '#000000');

  // 3. Orange (#FE760B) retains identity and returns #FFFFFF for button text
  const orangeAccent = getReadableAccentColor('#FE760B', true);
  assert.strictEqual(orangeAccent.toLowerCase(), '#fe760b');
  assert.strictEqual(getReadableButtonTextColor('#FE760B'), '#FFFFFF');

  // 4. Verify e/[slug]/page.jsx uses high contrast text classes for badges and host email
  const slugContent = fs.readFileSync(path.resolve(process.cwd(), 'src/app/(app)/e/[slug]/page.jsx'), 'utf-8');

  // Badges must use crisp text classes, not invisible dark style={{ color: themeAccent }}
  assert.match(slugContent, /Official event pass<\/span>/);
  assert.match(slugContent, /text-slate-800 dark:text-white[^>]*>[\s\S]*?Official event pass/);
  assert.match(slugContent, /text-slate-800 dark:text-white[^>]*>[\s\S]*?Happening now/);

  // Host email must have high contrast text classes
  assert.match(slugContent, /href=\{`mailto:\$\{organizerEmail\}`\}[^>]*text-slate-500 dark:text-\[#9B9EA4\]/);
});
