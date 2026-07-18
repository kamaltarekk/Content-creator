/** Plain-language option labels shared by every Reel-generation UI (Create First Reel wizard, context preview). */
export const CONTENT_OBJECTIVE_OPTIONS = [
  { value: "AWARENESS", label: "Make more people aware", helper: "First contact — get noticed." },
  { value: "TRUST", label: "Build trust", helper: "Show credibility and expertise." },
  { value: "EDUCATION", label: "Educate the market", helper: "Teach something true and useful." },
  { value: "BELIEF_CHANGE", label: "Change an important belief", helper: "Reframe a wrong belief into a better one." },
  { value: "OBJECTION_HANDLING", label: "Support the sales team", helper: "Remove a specific reason not to buy." },
  { value: "OFFER_PROMOTION", label: "Generate qualified leads, bookings, or purchases", helper: "A direct commercial ask." },
] as const;

export type ContentObjectiveValue = (typeof CONTENT_OBJECTIVE_OPTIONS)[number]["value"];
