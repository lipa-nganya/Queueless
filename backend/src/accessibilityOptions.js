/**
 * Venue accessibility options selected by admin/vendor per branch.
 * Stored in business_branches.accessibility_options as a JSON string array of ids.
 * Icons are rendered by clients (monochrome SVGs / vector icons) — no emoji.
 */

export const ACCESSIBILITY_OPTIONS = [
  {
    id: "wheelchair",
    label: "Wheelchair Accessible",
    description: "Step-free entrance and spaces/routes usable by wheelchair users",
  },
  {
    id: "blind_low_vision",
    label: "Blind & Low-Vision Friendly",
    description: "Staff/environment can reasonably assist blind or low-vision customers",
  },
  {
    id: "deaf_hard_of_hearing",
    label: "Deaf & Hard-of-Hearing Friendly",
    description: "Communication accommodations are available beyond spoken communication",
  },
  {
    id: "sign_language",
    label: "Sign Language Available",
    description: "At least one staff member or service option can communicate in sign language",
  },
  {
    id: "autism_friendly",
    label: "Autism-Friendly",
    description:
      "Accommodations are available for autistic customers, such as reduced sensory stimulation or flexible service",
  },
  {
    id: "quiet_low_sensory",
    label: "Quiet / Low-Sensory Space Available",
    description: "A quieter waiting or service area is available",
  },
  {
    id: "accessible_seating",
    label: "Accessible Seating Available",
    description: "Seating accommodates customers with mobility needs",
  },
  {
    id: "accessible_restroom",
    label: "Accessible Restroom Available",
    description: "An accessible toilet/restroom is available on the premises",
  },
  {
    id: "assistance_animals",
    label: "Assistance Animals Welcome",
    description: "Customers using trained assistance/service animals are accommodated",
  },
  {
    id: "support_person",
    label: "Support Person Welcome",
    description:
      "A customer may be accompanied by a caregiver, interpreter, aide, or other support person",
  },
];

const OPTION_IDS = new Set(ACCESSIBILITY_OPTIONS.map((item) => item.id));
const OPTION_BY_ID = Object.fromEntries(ACCESSIBILITY_OPTIONS.map((item) => [item.id, item]));

export function parseAccessibilityOptions(value) {
  let raw = value;
  if (raw == null || raw === "") return [];
  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw);
    } catch {
      raw = String(raw)
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean);
    }
  }
  if (!Array.isArray(raw)) return [];

  const seen = new Set();
  const ordered = [];
  for (const item of raw) {
    const id = typeof item === "string" ? item.trim() : String(item?.id || "").trim();
    if (!OPTION_IDS.has(id) || seen.has(id)) continue;
    seen.add(id);
    ordered.push(id);
  }
  // Keep catalog order for stable UI.
  return ACCESSIBILITY_OPTIONS.map((item) => item.id).filter((id) => seen.has(id));
}

export function serializeAccessibilityOptions(ids) {
  return JSON.stringify(parseAccessibilityOptions(ids));
}

export function resolveAccessibilityOptionsFromBody(body = {}) {
  if (
    typeof body.accessibility_options === "undefined" &&
    typeof body.accessibility === "undefined"
  ) {
    return undefined;
  }
  const source =
    typeof body.accessibility_options !== "undefined"
      ? body.accessibility_options
      : body.accessibility;
  return serializeAccessibilityOptions(source);
}

export function describeAccessibility(ids) {
  return parseAccessibilityOptions(ids)
    .map((id) => OPTION_BY_ID[id])
    .filter(Boolean);
}

export function enrichAccessibilityFields(row) {
  if (!row || typeof row !== "object") return row;
  const options = parseAccessibilityOptions(row.accessibility_options);
  return {
    ...row,
    accessibility_options: options,
    accessibility: describeAccessibility(options),
  };
}

export function mergeAccessibilityOptionLists(lists) {
  const seen = new Set();
  for (const list of lists || []) {
    for (const id of parseAccessibilityOptions(list)) seen.add(id);
  }
  return ACCESSIBILITY_OPTIONS.map((item) => item.id).filter((id) => seen.has(id));
}
