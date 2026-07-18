/** Lowercase, hyphenated, alnum-only slug from arbitrary text. Never empty — falls back to "org". */
export function slugify(text: string): string {
  const slug = text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "org";
}
