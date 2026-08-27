/**
 * Canonical business-group icons from the brand sheet.
 * Accent strokes pick up .accent so lime reads on light UI and navy on lime chips.
 */
const svg = (body) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.55" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;

export const GROUP_ICON_LABELS = {
  beauty: "Beauty & Wellness",
  healthcare: "Healthcare",
  financial: "Financial Services",
  automotive: "Automotive",
  hospitality: "Hospitality",
  government: "Government & Public Services",
  education: "Education Services",
  retail: "Retail & Telecom",
  professional: "Professional Services",
  travel: "Travel & Transport",
  entertainment: "Entertainment & Recreation",
  more: "More",
};

export const GROUP_ICONS = {
  beauty: svg(
    `<path d="M8.2 5.2c-1.6 1.2-2.4 3.2-1.6 5.1.7 1.7 2.4 2.6 4.1 2.2"/><path d="M15.8 5.2c1.6 1.2 2.4 3.2 1.6 5.1-.7 1.7-2.4 2.6-4.1 2.2"/><circle cx="7.4" cy="7.2" r="2"/><circle cx="16.6" cy="7.2" r="2"/><path class="accent" d="M8.5 18.5c.7-1.8 1.8-2.7 3.5-2.7s2.8.9 3.5 2.7"/><path class="accent" d="M10.2 16.2c-.2-1.4-1.4-2.2-2.6-1.8"/><path class="accent" d="M13.8 16.2c.2-1.4 1.4-2.2 2.6-1.8"/>`
  ),
  healthcare: svg(
    `<path d="M8 15.2c-2.4 0-4-1.7-4-4.1 0-2.6 1.8-4.3 4-4.3 1.5 0 2.5.7 3.2 1.7"/><path d="M8 15.2c1.8 0 2.7-1.4 3.4-3.1"/><circle cx="8" cy="11" r="1.15"/><rect class="accent" x="14.2" y="6.2" width="6.2" height="6.2" rx="1.1" fill="currentColor" stroke="none"/><path d="M17.3 7.7v3.2M15.7 9.3h3.2" stroke="#fff" stroke-width="1.6"/>`
  ),
  financial: svg(
    `<path d="M12 3.4 19 6.2v5.6c0 4.1-2.9 7.4-7 9-4.1-1.6-7-4.9-7-9V6.2L12 3.4Z"/><path class="accent" d="M8.6 13.4V11h1.5v2.4H8.6Zm2.7 0V9.4h1.5v4h-1.5Zm2.7 0V8.4H16v5h-1.5Z"/><path class="accent" d="M15.4 7.6 17 6.2l1.4 1.2"/>`
  ),
  automotive: svg(
    `<path d="M7.2 14.8 8 11.6c.2-.8.8-1.4 1.6-1.6h4.8c.8.2 1.4.8 1.6 1.6l.8 3.2"/><path d="M5.5 14.8h13"/><circle cx="8.2" cy="16.6" r="1.35"/><circle cx="15.8" cy="16.6" r="1.35"/><path d="M9.2 10.1V8.8c0-.5.4-.9.9-.9h3.8c.5 0 .9.4.9.9v1.3"/><path class="accent" d="M13.6 5.4c0 1-.8 1.5-1.4 2.4"/><circle class="accent" cx="12.2" cy="5.1" r="0.7"/><path d="M17.4 9.2 19 7.4m-1.1 0 .6 1.7"/>`
  ),
  hospitality: svg(
    `<path d="M6.2 16.6h11.6"/><path d="M7.4 16.6v-2.2a4.6 4.6 0 0 1 9.2 0v2.2"/><path d="M8.2 14.2c0-2.2 1.6-3.6 3.8-3.6s3.8 1.4 3.8 3.6"/><path d="M4.8 10.2v5.2M4.8 10.2c.7 0 1.2.6 1.2 1.4v1.2c0 .8-.5 1.4-1.2 1.4"/><path class="accent" d="M19.2 10.2v5.2M18 12.4h1.2"/><path class="accent" d="M10.4 6.4c.2-.8.6-1.4 1.1-1.8M12.6 6.2c.1-.7.5-1.3 1-1.7M14.6 6.6c.15-.7.5-1.2.9-1.6"/>`
  ),
  government: svg(
    `<rect x="5" y="5.2" width="12.4" height="13.6" rx="1.4"/><circle cx="9.1" cy="9.2" r="1.5"/><path d="M7.4 13.2h5.2M7.4 15.4h3.6"/><circle class="accent" cx="16.4" cy="16.6" r="3.1"/><path d="M15 16.6 16.1 17.7 18 15.6"/>`
  ),
  education: svg(
    `<path d="M4.8 12.2 12 9.2l7.2 3-7.2 3-7.2-3Z"/><path d="M7.4 13.4v3.2c1.3.8 2.8 1.2 4.6 1.2s3.3-.4 4.6-1.2v-3.2"/><path class="accent" d="M12 4.6 16.8 7.2 12 9.4 7.2 7.2 12 4.6Z"/><path class="accent" d="M16.8 7.2v2.4"/>`
  ),
  retail: svg(
    `<path d="M5.4 8.4h7.2l-.7 6.4H6.6L5.4 8.4Z"/><path d="M7.2 8.4 7.8 6.6h3.2l.6 1.8"/><circle class="accent" cx="7.2" cy="16.8" r="1"/><circle class="accent" cx="11.2" cy="16.8" r="1"/><rect x="14.2" y="5.4" width="5.2" height="8.8" rx="1.1"/><path class="accent" d="M16.8 16.2c1.4.1 2.6.8 3.4 1.8"/>`
  ),
  professional: svg(
    `<path d="M5.4 10.2h13.2v8.2H5.4V10.2Z"/><path d="M9.2 10.2V8.6c0-.8.6-1.4 1.4-1.4h2.8c.8 0 1.4.6 1.4 1.4v1.6"/><circle class="accent" cx="12" cy="14.2" r="2.1"/><path class="accent" d="M8.8 19.2c.8-1.8 2-2.7 3.2-2.7s2.4.9 3.2 2.7"/>`
  ),
  travel: svg(
    `<path d="M4.8 15.2 11 12.4l7.4-6.2-1.8 7.6-6.4 2.4-2.2 3.2-1.2-1.6 1.2-2.8-3.2-1.8Z"/><path d="M11 12.4 8.2 9.2"/><path class="accent" d="M14.2 16.8c.6-.4 1.6-.5 2.4.1"/><path class="accent" d="M16.2 14.6c.9.2 1.6.9 1.8 1.8"/><circle class="accent" cx="18.4" cy="18.2" r="1.7"/><path d="M18.4 17.4v1.6M18.4 18.2h.9"/>`
  ),
  entertainment: svg(
    `<path d="M4.6 8.4h8.2v8.4c0 .7-.6 1.2-1.2 1.2H5.8c-.7 0-1.2-.5-1.2-1.2V8.4Z"/><path d="M4.6 11.2h8.2"/><path class="accent" d="m8.7 9.6.5 1.4h1.5l-1.2.9.5 1.4-1.3-.9-1.3.9.5-1.4-1.2-.9h1.5l.5-1.4Z"/><circle cx="17.2" cy="13.2" r="4.1"/><path class="accent" d="M17.2 9.3c1.1 1.1 1.7 2.4 1.7 3.9s-.6 2.8-1.7 3.9M17.2 9.3c-1.1 1.1-1.7 2.4-1.7 3.9s.6 2.8 1.7 3.9M13.3 13.2h7.8"/>`
  ),
  more: svg(
    `<circle cx="6" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="18" cy="12" r="1.5" fill="currentColor" stroke="none"/>`
  ),
};

export const ICON_ALIASES = {
  scissors: "beauty",
  salon: "beauty",
  clinic: "healthcare",
  pharmacy: "healthcare",
  bank: "financial",
  car: "automotive",
  restaurant: "hospitality",
  shop: "retail",
  phone: "retail",
  fitness: "entertainment",
};

export const GROUP_ICON_KEYS = Object.keys(GROUP_ICONS).filter((key) => key !== "more");

export function resolveGroupIconKey(key) {
  return ICON_ALIASES[key] || key || "more";
}

export function groupIconSvg(key) {
  return GROUP_ICONS[resolveGroupIconKey(key)] || GROUP_ICONS.more;
}
