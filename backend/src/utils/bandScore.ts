/**
 * Scales a raw score to a 40-question IELTS scale and maps it to a band score (0.0 - 9.0 in 0.5 steps).
 * 
 * @param rawScore Number of correct answers.
 * @param totalQuestions Total number of questions in the test.
 * @returns The estimated IELTS band score.
 */
export function rawScoreToBand(rawScore: number, totalQuestions: number): number {
  if (totalQuestions <= 0) return 0.0;
  if (rawScore <= 0) return 0.0;

  // Convert (rawScore, totalQuestions) to an equivalent 40-question raw score
  const equivalentRaw = Math.round((rawScore / totalQuestions) * 40);
  
  // Clamp to 0-40 range
  const clampedRaw = Math.max(0, Math.min(40, equivalentRaw));

  // IELTS Academic Reading/Listening standard 40-question band score table lookup
  if (clampedRaw >= 39) return 9.0;
  if (clampedRaw >= 37) return 8.5;
  if (clampedRaw >= 35) return 8.0;
  if (clampedRaw >= 33) return 7.5;
  if (clampedRaw >= 30) return 7.0;
  if (clampedRaw >= 27) return 6.5;
  if (clampedRaw >= 23) return 6.0;
  if (clampedRaw >= 19) return 5.5;
  if (clampedRaw >= 15) return 5.0;
  if (clampedRaw >= 13) return 4.5;
  if (clampedRaw >= 10) return 4.0;
  if (clampedRaw >= 8) return 3.5;
  if (clampedRaw >= 6) return 3.0;
  if (clampedRaw >= 4) return 2.5;
  if (clampedRaw >= 2) return 2.0;
  if (clampedRaw === 1) return 1.0;
  return 0.0;
}
