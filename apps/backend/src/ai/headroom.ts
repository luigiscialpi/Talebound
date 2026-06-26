export interface CompressedHistoryResult {
  compressedHistory: string;
  headroomRatio: number;
}

/**
 * Headroom - Context compression helper (doc §10).
 *
 * Compresses turn history entries to save LLM context window space,
 * calculating the compression ratio.
 */
export function compressHistory(
  history: Array<{ action: string; narrative: string }>
): CompressedHistoryResult {
  if (!history || history.length === 0) {
    return { compressedHistory: "", headroomRatio: 0 };
  }

  // Calculate the original raw string representation of the history
  const originalStr = history
    .map((h, i) => `Turn ${i + 1}:\nPlayer: ${h.action}\nNarrator: ${h.narrative}`)
    .join("\n\n");

  const originalLength = originalStr.length;
  if (originalLength === 0) {
    return { compressedHistory: "", headroomRatio: 0 };
  }

  // Compress entries by trimming whitespace and slicing long text to keep it compact.
  const compressedStr = history
    .map((h, i) => {
      const cleanAction = h.action.trim().replace(/\s+/g, " ");
      let cleanNarrative = h.narrative.trim().replace(/\s+/g, " ");

      if (cleanNarrative.length > 120) {
        cleanNarrative = cleanNarrative.slice(0, 117) + "...";
      }

      return `T${i + 1}: ${cleanAction} -> ${cleanNarrative}`;
    })
    .join("\n");

  const compressedLength = compressedStr.length;
  const headroomRatio = (originalLength - compressedLength) / originalLength;

  // Log warning if compression is overly aggressive (> 90%) as per doc §10.
  if (headroomRatio > 0.9) {
    console.warn(
      `[headroom] Alert: headroomRatio too aggressive: ${headroomRatio.toFixed(2)}`
    );
  }

  return {
    compressedHistory: compressedStr,
    headroomRatio: Math.max(0, headroomRatio),
  };
}
