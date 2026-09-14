/**
 * Brand-style business-group icons.
 * White/navy primary strokes; lime accents via .accent (lime on light UI, navy on lime chips).
 */
const svg = (body) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${body}</svg>`;

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
  // Woman + man profiles facing out, two lime leaves below
  beauty: svg(`
    <path d="M9.4 5.8C7 6.1 5.4 8 5.4 10.2c0 1.6.9 2.9 2.2 3.4"/>
    <path d="M9.4 5.8c.5 1.6 0 3.1-1.3 4"/>
    <path d="M14.6 5.8c2.4.3 4 2.2 4 4.4 0 1.6-.9 2.9-2.2 3.4"/>
    <path d="M14.6 5.8c-.5 1.6 0 3.1 1.3 4"/>
    <path class="accent" d="M10.4 19c.4-1.5 1.1-2.4 1.6-2.4s1.2.9 1.6 2.4"/>
    <path class="accent" d="M8.2 15.6c1.2-.2 2 .8 2.1 2.1-1.3.3-2.3-.8-2.1-2.1Z" fill="currentColor" stroke="none"/>
    <path class="accent" d="M15.8 15.6c-1.2-.2-2 .8-2.1 2.1 1.3.3 2.3-.8 2.1-2.1Z" fill="currentColor" stroke="none"/>
  `),

  // Stethoscope + lime medical badge with white cross
  healthcare: svg(`
    <path d="M7 15.6c-2.6 0-4.4-1.9-4.4-4.5S4.6 6.6 7 6.6c1.7 0 2.9.9 3.6 2.1"/>
    <path d="M7 15.6c2 0 3.1-1.6 3.8-3.5"/>
    <circle cx="7" cy="11.1" r="1.25"/>
    <rect class="accent" x="13.6" y="5.6" width="6.6" height="6.6" rx="1.3" fill="currentColor" stroke="none"/>
    <path d="M16.9 7.2v3.4M15.2 8.9h3.4" stroke="#fff" stroke-width="1.6"/>
  `),

  // Shield with rising lime bars + arrow
  financial: svg(`
    <path d="M12 3.1 19.3 6v5.9c0 4.3-3.1 7.7-7.3 9.3C7.8 19.6 4.7 16.2 4.7 11.9V6L12 3.1Z"/>
    <path class="accent" d="M8.3 14.4V11h1.5v3.4H8.3Z" fill="currentColor" stroke="none"/>
    <path class="accent" d="M11.2 14.4V9.4h1.5v5H11.2Z" fill="currentColor" stroke="none"/>
    <path class="accent" d="M14.1 14.4V8.2h1.5v6.2H14.1Z" fill="currentColor" stroke="none"/>
    <path class="accent" d="M15.5 7.1 17.2 5.4l1.5 1.5"/>
  `),

  // Car front, lime oil drop, lime wrench
  automotive: svg(`
    <path d="M6.6 14.8 7.4 11.3c.25-.95 1-1.6 1.95-1.8h5.3c.95.2 1.7.85 1.95 1.8l.8 3.5"/>
    <path d="M4.8 14.8h14.4"/>
    <circle cx="8" cy="16.7" r="1.4"/>
    <circle cx="16" cy="16.7" r="1.4"/>
    <path d="M9.1 9.5V8.3c0-.55.4-1 .95-1h3.9c.55 0 .95.45.95 1v1.2"/>
    <path class="accent" d="M11.2 4.2c0 1.15-.85 1.8-1.45 2.7"/>
    <circle class="accent" cx="9.85" cy="4" r="0.8" fill="currentColor" stroke="none"/>
    <path class="accent" d="M17.5 8.6 19.4 6.5m-1.25.05.75 2"/>
  `),

  // Cloche with lime steam, fork left, knife right
  hospitality: svg(`
    <path d="M6.3 17.1h11.4"/>
    <path d="M7.5 17.1v-2.5a4.5 4.5 0 0 1 9 0v2.5"/>
    <path d="M8.3 14.4c0-2.2 1.6-3.5 3.7-3.5s3.7 1.3 3.7 3.5"/>
    <path d="M4.5 9.6v5.6M4.5 9.6c.75 0 1.25.65 1.25 1.45v1.5c0 .8-.5 1.45-1.25 1.45"/>
    <path class="accent" d="M19.5 9.6v5.6M18.2 12.1h1.3"/>
    <path class="accent" d="M10.1 6c.25-.85.7-1.5 1.2-1.95M12.4 5.8c.2-.8.55-1.4 1.05-1.85M14.5 6.2c.2-.75.55-1.3 1-1.7"/>
  `),

  // ID card + lime verified badge
  government: svg(`
    <rect x="4.5" y="4.6" width="12.8" height="14.6" rx="1.5"/>
    <circle cx="8.7" cy="8.9" r="1.6"/>
    <path d="M6.9 13.1h5.5M6.9 15.4h3.9"/>
    <circle class="accent" cx="16.7" cy="16.9" r="3.25" fill="currentColor" stroke="none"/>
    <path d="M15.2 16.9 16.4 18.1 18.5 15.7" stroke="#fff" stroke-width="1.55"/>
  `),

  // Graduation cap on open book
  education: svg(`
    <path d="M4.5 13.3 12 9.7l7.5 3.6-7.5 3.5-7.5-3.5Z"/>
    <path d="M7.1 14.8v3.5c1.45.85 3 1.25 4.9 1.25s3.45-.4 4.9-1.25v-3.5"/>
    <path class="accent" d="M12 4.2 17.4 7.1 12 9.6 6.6 7.1 12 4.2Z"/>
    <path class="accent" d="M17.4 7.1v2.7"/>
  `),

  // Cart + phone with contactless arcs
  retail: svg(`
    <path d="M5.1 8.1h7.5l-.85 6.7H6.5L5.1 8.1Z"/>
    <path d="M6.9 8.1 7.55 6.3h3.5L11.7 8.1"/>
    <circle class="accent" cx="7" cy="16.9" r="1.1" fill="currentColor" stroke="none"/>
    <circle class="accent" cx="11.2" cy="16.9" r="1.1" fill="currentColor" stroke="none"/>
    <rect x="13.9" y="5.1" width="5.5" height="9.3" rx="1.2"/>
    <path class="accent" d="M16.65 16.2c1.55.2 2.9.95 3.75 2"/>
    <path class="accent" d="M16.65 17.45c.95.15 1.8.6 2.35 1.25"/>
  `),

  // Briefcase with person silhouette in front
  professional: svg(`
    <path d="M5.1 9.8h13.8v8.5H5.1V9.8Z"/>
    <path d="M9 9.8V8.2c0-.85.65-1.5 1.5-1.5h3c.85 0 1.5.65 1.5 1.5v1.6"/>
    <path d="M5.1 13h13.8"/>
    <circle class="accent" cx="12" cy="14.5" r="2" fill="currentColor" stroke="none"/>
    <path class="accent" d="M8.5 19.4c.8-1.85 2.1-2.8 3.5-2.8s2.7.95 3.5 2.8" fill="currentColor" stroke="none"/>
  `),

  // Plane, dotted path, lime map pin
  travel: svg(`
    <path d="M4.5 15.5 11.1 12.4 19.2 5.4l-2.1 8-6.7 2.6-2.4 3.5-1.25-1.75 1.2-2.95-3.45-1.9Z"/>
    <path d="M11.1 12.4 8 8.9"/>
    <path d="M13.6 16.5c1-.15 2.2.15 3.1.95" stroke-dasharray="1 1.5"/>
    <path class="accent" d="M18.5 15.6c1.35 0 2.45 1.05 2.45 2.35 0 1.7-2.45 3.55-2.45 3.55s-2.45-1.85-2.45-3.55c0-1.3 1.1-2.35 2.45-2.35Z" fill="currentColor" stroke="none"/>
    <circle cx="18.5" cy="17.9" r="0.7" fill="#fff" stroke="none"/>
  `),

  // Ticket with lime star + basketball with lime seams
  entertainment: svg(`
    <path d="M4.3 8h8.5v8.8c0 .75-.6 1.3-1.3 1.3H5.6c-.7 0-1.3-.55-1.3-1.3V8Z"/>
    <path d="M4.3 11.1h8.5"/>
    <path class="accent" d="m8.55 9.2.55 1.55h1.6l-1.3 1 .5 1.55-1.35-1-1.35 1 .5-1.55-1.3-1h1.6l.55-1.55Z" fill="currentColor" stroke="none"/>
    <circle cx="17.2" cy="13.2" r="4.3"/>
    <path class="accent" d="M17.2 8.9c1.2 1.2 1.85 2.6 1.85 4.3s-.65 3.1-1.85 4.3M17.2 8.9c-1.2 1.2-1.85 2.6-1.85 4.3s.65 3.1 1.85 4.3M13.1 13.2h8.2"/>
  `),

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
