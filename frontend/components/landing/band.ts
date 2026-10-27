/** The four modules in the order they appear on a Test Report Form. */
export const MODULES = ["Listening", "Reading", "Writing", "Speaking"] as const;

export type ParseResult =
  | { ok: true; bands: [number, number, number, number] }
  | { ok: false; message: string };

/**
 * Reads four module bands from free text. Lenient about separators ("7.5 6.5 6 6.5",
 * "7.5, 6.5, 6, 6.5", "7.5/6.5/6/6.5") and a decimal comma ("7,5" when spaces separate).
 */
export function parseBands(raw: string): ParseResult {
  const text = raw.trim();
  if (!text) {
    return { ok: false, message: "Type four bands, one for each module: Listening, Reading, Writing, Speaking." };
  }
  // A comma between two digits with no space is a decimal comma only when spaces already separate the bands.
  const normalised = /\s/.test(text) ? text.replace(/(\d),(\d)/g, "$1.$2") : text;
  const tokens = normalised.split(/[\s,;/|+]+/).filter(Boolean);

  if (tokens.length !== 4) {
    return {
      ok: false,
      message:
        tokens.length < 4
          ? `That is ${tokens.length} band${tokens.length === 1 ? "" : "s"}. Type four, one for each module.`
          : `That is ${tokens.length} bands. A report has four: Listening, Reading, Writing, Speaking.`,
    };
  }

  const bands: number[] = [];
  for (const token of tokens) {
    const value = Number(token);
    if (!Number.isFinite(value)) {
      return { ok: false, message: `"${token.slice(0, 12)}" is not a number. Bands are figures such as 6 or 6.5.` };
    }
    if (value < 0 || value > 9) {
      return { ok: false, message: `${token} is outside the scale. Bands run from 0 to 9.` };
    }
    if (!Number.isInteger(value * 2)) {
      return { ok: false, message: `${token} is not a band. Bands go up in half steps: 6, 6.5, 7.` };
    }
    bands.push(value);
  }
  return { ok: true, bands: bands as [number, number, number, number] };
}

/**
 * The published overall-band rule: average the four module bands, then round to the nearest
 * half band, where an average ending in .25 rounds up to the next half band and one ending
 * in .75 rounds up to the next whole band.
 */
export function overallBand(bands: readonly number[]): { mean: number; overall: number; why: string } {
  const sum = bands.reduce((a, b) => a + b, 0);
  const mean = sum / bands.length;
  const whole = Math.floor(mean);
  const fraction = mean - whole;

  let overall: number;
  if (fraction < 0.25) overall = whole;
  else if (fraction < 0.75) overall = whole + 0.5;
  else overall = whole + 1;

  const f = Math.round(fraction * 1000) / 1000;
  const ends = `${f}`.replace(/^0/, "");
  let why: string;
  if (f === 0 || f === 0.5) why = "That is already a band, so it stands.";
  else if (f === 0.25) why = "That ends in .25, so it rounds up to the next half band.";
  else if (f === 0.75) why = "That ends in .75, so it rounds up to the next whole band.";
  else if (f < 0.25) why = `That ends in ${ends}, below .25, so it rounds down to the whole band.`;
  else if (f < 0.5) why = `That ends in ${ends}, between .25 and .5, so it rounds up to the half band.`;
  else if (f < 0.75) why = `That ends in ${ends}, between .5 and .75, so it rounds down to the half band.`;
  else why = `That ends in ${ends}, above .75, so it rounds up to the next whole band.`;

  return { mean, overall, why };
}

export function formatBand(value: number): string {
  return Number.isInteger(value) ? `${value}` : value.toFixed(1);
}

export function formatMean(value: number): string {
  return `${Math.round(value * 1000) / 1000}`;
}
