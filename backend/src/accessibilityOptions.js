/**
 * Venue accessibility options selected by admin/vendor per branch.
 * Stored in business_branches.accessibility_options as a JSON string array of ids.
 * Customers pick from the same ids to tell staff what they need (`need` wording).
 * Icons are rendered by clients (monochrome SVGs / vector icons) — no emoji.
 */

export const ACCESSIBILITY_OPTIONS = [
  {
    id: "wheelchair",
    label: "Wheelchair Accessible",
    need: "Wheelchair user / step-free access",
    short: "Wheelchair",
    description: "Step-free entrance and spaces/routes usable by wheelchair users",
  },
  {
    id: "blind_low_vision",
    label: "Blind & Low-Vision Friendly",
    need: "Blind or low vision",
    short: "Low vision",
    description: "Staff/environment can reasonably assist blind or low-vision customers",
  },
  {
    id: "deaf_hard_of_hearing",
    label: "Deaf & Hard-of-Hearing Friendly",
    need: "Deaf or hard of hearing",
    short: "Deaf/HoH",
    description: "Communication accommodations are available beyond spoken communication",
  },
  {
    id: "sign_language",
    label: "Sign Language Available",
    need: "Sign language",
    short: "Sign language",
    description: "At least one staff member or service option can communicate in sign language",
  },
  {
    id: "autism_friendly",
    label: "Autism-Friendly",
    need: "Autistic / flexible service",
    short: "Autistic",
    description:
      "Accommodations are available for autistic customers, such as reduced sensory stimulation or flexible service",
  },
  {
    id: "quiet_low_sensory",
    label: "Quiet / Low-Sensory Space Available",
    need: "Quiet, low-sensory space",
    short: "Quiet space",
    description: "A quieter waiting or service area is available",
  },
  {
    id: "accessible_seating",
    label: "Accessible Seating Available",
    need: "Needs a seat while waiting",
    short: "Needs seat",
    description: "Seating accommodates customers with mobility needs",
  },
  {
    id: "accessible_restroom",
    label: "Accessible Restroom Available",
    need: "Accessible restroom",
    short: "Accessible WC",
    description: "An accessible toilet/restroom is available on the premises",
  },
  {
    id: "assistance_animals",
    label: "Assistance Animals Welcome",
    need: "With an assistance animal",
    short: "Assist. animal",
    description: "Customers using trained assistance/service animals are accommodated",
  },
  {
    id: "support_person",
    label: "Support Person Welcome",
    need: "With a support person",
    short: "Support person",
    description:
      "A customer may be accompanied by a caregiver, interpreter, aide, or other support person",
  },
];

export const ACCESSIBILITY_NOTE_MAX = 160;

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

/** Customer-facing need labels, in catalog order. */
export function describeAccessibilityNeeds(ids) {
  return parseAccessibilityOptions(ids)
    .map((id) => OPTION_BY_ID[id])
    .filter(Boolean)
    .map((item) => ({ id: item.id, label: item.need }));
}

/** Compact need labels for SMS, where every character past 160 costs a segment. */
export function shortAccessibilityNeedLabels(ids) {
  return parseAccessibilityOptions(ids)
    .map((id) => OPTION_BY_ID[id]?.short || OPTION_BY_ID[id]?.need)
    .filter(Boolean);
}

export function parseAccessibilityNote(value) {
  const text = String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
  return text ? text.slice(0, ACCESSIBILITY_NOTE_MAX) : null;
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
