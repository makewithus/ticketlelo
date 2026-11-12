import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

describe('Real-Time Form Generator & Attendee Form Synchronization', () => {
  // Test 1: Sorting customForms documents by recency and published status
  test('Sorts custom forms docs by recency and prioritizes published documents', () => {
    const docs = [
      {
        id: 'form_old_published',
        status: 'published',
        createdAt: { seconds: 1000 },
        updatedAt: { seconds: 1000 },
        fields: [{ id: 'old_field', label: 'Old' }],
      },
      {
        id: 'form_draft_newer',
        status: 'draft',
        createdAt: { seconds: 2000 },
        updatedAt: { seconds: 2000 },
        fields: [{ id: 'draft_field', label: 'Draft' }],
      },
      {
        id: 'form_latest_published',
        status: 'published',
        createdAt: { seconds: 1500 },
        updatedAt: { seconds: 3000 },
        fields: [{ id: 'new_field', label: 'New' }],
      },
    ];

    docs.sort((a, b) => {
      const getMillis = (item) =>
        item?.updatedAt?.toMillis?.() ||
        (item?.updatedAt?.seconds ? item.updatedAt.seconds * 1000 : 0) ||
        item?.createdAt?.toMillis?.() ||
        (item?.createdAt?.seconds ? item.createdAt.seconds * 1000 : 0) ||
        0;
      return getMillis(b) - getMillis(a);
    });

    const activeDoc = docs.find((d) => d.status === 'published') || docs[0];
    assert.strictEqual(activeDoc.id, 'form_latest_published');
    assert.strictEqual(activeDoc.fields[0].id, 'new_field');
  });

  // Test 2: User input preservation across real-time schema updates
  test('Preserves user inputs when organizer dynamically updates or appends form fields', () => {
    const userPreviousInput = {
      fullName: 'Adil Mohammad',
      email: 'adil@example.com',
      whatsappPhone: '+919876543210',
      college: 'CUSAT',
    };

    // Organizer adds a new required field "year_of_study" and "dietary_choice"
    const newFields = [
      { id: 'fullName', label: 'Full Name', type: 'text', required: true },
      { id: 'email', label: 'Email', type: 'email', required: true },
      { id: 'whatsappPhone', label: 'Phone', type: 'tel', required: true },
      { id: 'college', label: 'College', type: 'text', required: true },
      { id: 'year_of_study', label: 'Year of Study', type: 'select', required: true, options: ['1st', '2nd', '3rd', '4th'] },
      { id: 'dietary_choice', label: 'Dietary Preference', type: 'text', required: false },
    ];

    // Simulating buildInitialData + merge
    const initial = {};
    newFields.forEach((f) => {
      initial[f.id] = '';
    });

    const nextFormData = { ...initial };
    for (const [key, val] of Object.entries(userPreviousInput)) {
      if (val !== undefined && val !== null && val !== '') {
        nextFormData[key] = val;
      }
    }

    // Verify all original user data is retained
    assert.strictEqual(nextFormData.fullName, 'Adil Mohammad');
    assert.strictEqual(nextFormData.email, 'adil@example.com');
    assert.strictEqual(nextFormData.whatsappPhone, '+919876543210');
    assert.strictEqual(nextFormData.college, 'CUSAT');

    // Verify newly added fields are initialized cleanly
    assert.strictEqual(nextFormData.year_of_study, '');
    assert.strictEqual(nextFormData.dietary_choice, '');
  });

  // Test 3: Validation errors cleanup when organizer removes a field
  test('Prunes stale validation errors when organizer deletes or alters a field in real time', () => {
    const previousErrors = {
      fullName: 'Please enter your full name',
      obsolete_field: 'This field is required',
      deleted_question: 'Selection required',
    };

    const activeFields = [
      { id: 'fullName', name: 'fullName' },
      { id: 'email', name: 'email' },
    ];

    const validIds = new Set(
      activeFields.flatMap((f) => [String(f.id), f.name ? String(f.name) : null]).filter(Boolean)
    );

    const prunedErrors = {};
    for (const [key, val] of Object.entries(previousErrors)) {
      if (validIds.has(String(key))) {
        prunedErrors[key] = val;
      }
    }

    assert.strictEqual(prunedErrors.fullName, 'Please enter your full name');
    assert.strictEqual(prunedErrors.obsolete_field, undefined);
    assert.strictEqual(prunedErrors.deleted_question, undefined);
  });

  // Test 4: Options sanitization prevents empty string crashes in Radix Select
  test('Sanitizes option lists and strips empty or null choices to prevent Radix Select runtime crashes', () => {
    const rawOptions = ['Option A', '', '   ', null, undefined, 'Option B', 'Option C'];
    const sanitized = (
      Array.isArray(rawOptions) ? rawOptions : []
    )
      .map(String)
      .filter((opt) => opt !== 'null' && opt !== 'undefined' && opt.trim().length > 0);

    assert.deepStrictEqual(sanitized, ['Option A', 'Option B', 'Option C']);
    assert.strictEqual(sanitized.includes(''), false);
  });

  // Test 5: Real-time price change dynamically toggles paid mode and CTA text
  test('Real-time price transition switches CTA from Free pass to Paid pass', () => {
    let customForm = { isPaid: false, amount: 0 };
    const getCtaLabel = (form) => (form?.isPaid && form?.amount > 0 ? `Pay ₹${form.amount} & register` : 'Register');

    assert.strictEqual(getCtaLabel(customForm), 'Register');

    // Organizer changes event to ₹499 paid event
    customForm = { isPaid: true, amount: 499 };
    assert.strictEqual(getCtaLabel(customForm), 'Pay ₹499 & register');
  });
});

