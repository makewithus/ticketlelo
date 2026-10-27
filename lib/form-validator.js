/**
 * Unified Registration Form Validator (Client & Server Authoritative)
 * Validates responses against dynamic form schemas with conditional sub-event support (P02, FORM-001–015).
 */

export const PRESET_FIELD_DEFINITIONS = {
  fullName: {
    id: "fullName",
    label: "Full Name",
    type: "text",
    required: true,
    placeholder: "e.g. Rahul Sharma",
    helpText: "As it should appear on your ticket and certificate",
  },
  email: {
    id: "email",
    label: "Email Address",
    type: "email",
    required: true,
    placeholder: "rahul@example.com",
    helpText: "Ticket QR and confirmation will be sent here",
  },
  whatsappPhone: {
    id: "whatsappPhone",
    label: "WhatsApp Phone Number",
    type: "tel",
    required: true,
    placeholder: "10-digit mobile number",
    helpText: "For event updates and gate assistance",
  },
  college: {
    id: "college",
    label: "College / University",
    type: "text",
    required: true,
    placeholder: "e.g. Indian Institute of Technology",
  },
  department: {
    id: "department",
    label: "Department / Branch",
    type: "text",
    required: false,
    placeholder: "e.g. Computer Science & Engineering",
  },
  yearOfStudy: {
    id: "yearOfStudy",
    label: "Year of Study",
    type: "select",
    required: false,
    options: ["1st Year", "2nd Year", "3rd Year", "4th Year", "Postgraduate", "Faculty / Alumni"],
  },
  city: {
    id: "city",
    label: "City",
    type: "text",
    required: false,
    placeholder: "e.g. Mumbai, Bangalore",
  },
  address: {
    id: "address",
    label: "Postal Address",
    type: "textarea",
    required: false,
    placeholder: "Full mailing address (if physical kit delivery applies)",
  },
};

/**
 * Filter form fields based on active/selected sub-events.
 * Fields with no `conditionalOnSubEventIds` are universal.
 * Fields with `conditionalOnSubEventIds` only show if at least one selected sub-event matches.
 */
export function filterFormFieldsForEntitlements(fields = [], selectedSubEventIds = []) {
  if (!Array.isArray(fields)) return [];
  const selectedSet = new Set(selectedSubEventIds || []);

  return fields.filter((field) => {
    // If not conditioned on sub-events, it is universally visible
    if (!field.conditionalOnSubEventIds || field.conditionalOnSubEventIds.length === 0) {
      return true;
    }
    // Conditioned: at least one included sub-event must match
    return field.conditionalOnSubEventIds.some((id) => selectedSet.has(id));
  });
}

/**
 * Validate a submission payload against the applicable form fields.
 */
export function validateFormSubmission(fields = [], submissionData = {}, selectedSubEventIds = []) {
  const applicableFields = filterFormFieldsForEntitlements(fields, selectedSubEventIds);
  const errors = {};

  for (const field of applicableFields) {
    const value = submissionData[field.id || field.name];

    // 1. Required Check
    if (field.required) {
      if (value === undefined || value === null || (typeof value === "string" && value.trim() === "")) {
        errors[field.id || field.name] = `${field.label || "This field"} is required.`;
        continue;
      }
    }

    // Skip validation if optional and empty
    if (value === undefined || value === null || value === "") {
      continue;
    }

    // 2. Type-specific Validation
    if (field.type === "email") {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(String(value).trim())) {
        errors[field.id || field.name] = "Please enter a valid email address.";
      }
    } else if (field.type === "tel") {
      const cleanPhone = String(value).replace(/\D/g, "");
      if (cleanPhone.length < 10 || cleanPhone.length > 15) {
        errors[field.id || field.name] = "Please enter a valid phone number (10-15 digits).";
      }
    } else if (field.type === "select" || field.type === "radio") {
      if (field.options && field.options.length > 0 && !field.options.includes(value)) {
        errors[field.id || field.name] = "Please select a valid option from the list.";
      }
    } else if (field.type === "checkbox" && field.required && !value) {
      errors[field.id || field.name] = "You must agree to continue.";
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}
