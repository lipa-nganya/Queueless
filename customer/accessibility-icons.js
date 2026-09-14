/**
 * Monochrome accessibility icons (currentColor). No emoji.
 * Keys match accessibility option ids.
 */
const svg = (body) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${body}</svg>`;

export const ACCESSIBILITY_ICONS = {
  wheelchair: svg(`
    <circle cx="14" cy="5" r="1.6"/>
    <path d="M14 7.2v4.2l3.2 1.6 1.4 3.4"/>
    <path d="M7.2 9.2h5.2"/>
    <circle cx="8.2" cy="16.6" r="3.2"/>
    <path d="M11.2 16.2h3.6l1.2-2.4"/>
  `),
  blind_low_vision: svg(`
    <circle cx="12" cy="12" r="2"/>
    <path d="M2.8 12S6.2 6.8 12 6.8 21.2 12 21.2 12 17.8 17.2 12 17.2 2.8 12 2.8 12Z"/>
    <path d="M4.2 19.2 19.8 4.8"/>
  `),
  deaf_hard_of_hearing: svg(`
    <path d="M8.2 9.2a4 4 0 0 1 7.6 1.6c0 2-1.4 2.8-2.2 3.4S12.2 15.2 12.2 16.4"/>
    <circle cx="12.2" cy="19" r="0.9" fill="currentColor" stroke="none"/>
    <path d="M5.2 8.2a7.2 7.2 0 0 1 13.6 0"/>
  `),
  sign_language: svg(`
    <path d="M8.5 13.5V8.2a1.2 1.2 0 0 1 2.4 0v3.4"/>
    <path d="M10.9 11.6V7.4a1.2 1.2 0 0 1 2.4 0v4.2"/>
    <path d="M13.3 11.6V8.6a1.2 1.2 0 0 1 2.4 0v5.2c0 2.4-1.6 4.2-4.2 4.2h-1.2c-2.4 0-4-1.5-4-3.8v-2.4a1.2 1.2 0 0 1 2.4 0v1.7"/>
    <path d="M15.7 13.2V10a1.1 1.1 0 0 1 2.2 0v3.8"/>
  `),
  autism_friendly: svg(`
    <path d="M8.2 9.2a2.2 2.2 0 1 1 2.2-2.2"/>
    <path d="M13.6 7a2.2 2.2 0 1 1 2.2 2.2"/>
    <path d="M15.8 13.6a2.2 2.2 0 1 1-2.2 2.2"/>
    <path d="M10.4 15.8A2.2 2.2 0 1 1 8.2 13.6"/>
    <path d="M10.2 8.8 13.8 10.4 12.4 14.2 8.8 12.6Z"/>
  `),
  quiet_low_sensory: svg(`
    <path d="M4.5 9.5h2.4L11 6.2v11.6L6.9 14.5H4.5Z"/>
    <path d="M15.2 9.2 20 14"/>
    <path d="M20 9.2 15.2 14"/>
  `),
  accessible_seating: svg(`
    <path d="M7 5.5h7.5v5.2H9.2"/>
    <path d="M9.2 10.7H18v2.4H9.2Z"/>
    <path d="M9.2 13.1v5.4"/>
    <path d="M16.6 13.1v5.4"/>
    <path d="M7.4 18.5h3.4"/>
    <path d="M14.8 18.5h3.4"/>
  `),
  accessible_restroom: svg(`
    <circle cx="8.2" cy="5.4" r="1.5"/>
    <path d="M8.2 7.4v4.6l-2.2 5.5"/>
    <path d="M8.2 12l2.2 5.5"/>
    <path d="M6.2 10.2h4"/>
    <circle cx="16.2" cy="5.4" r="1.5"/>
    <path d="M16.2 7.4v3.2h2.4v7.9"/>
    <path d="M13.8 18.5h4.8"/>
    <path d="M16.2 10.6 14 18.5"/>
  `),
  assistance_animals: svg(`
    <path d="M6.2 12.2c0-2.2 1.6-4 4.2-4h1.4c1.2 0 2 .4 2.7 1"/>
    <path d="M14.8 9.8c.8-.5 1.7-.7 2.8-.5 1.4.3 2.4 1.4 2.4 2.9v1.4"/>
    <path d="M5.5 14.2h10.2c1.4 0 2.5 1 2.5 2.4v1.4H8.4"/>
    <circle cx="8.2" cy="8.2" r="1.1"/>
    <circle cx="12.4" cy="7.6" r="1.1"/>
    <path d="M7.2 18.5h3.2"/>
  `),
  support_person: svg(`
    <circle cx="9" cy="7.2" r="2"/>
    <path d="M4.8 17.8v-1.2c0-2.2 1.8-3.8 4.2-3.8s4.2 1.6 4.2 3.8v1.2"/>
    <circle cx="16.4" cy="8" r="1.7"/>
    <path d="M20.2 17.8v-.8c0-1.8-1.4-3.2-3.4-3.4"/>
  `),
};

export function accessibilityIconSvg(id) {
  return ACCESSIBILITY_ICONS[id] || "";
}
