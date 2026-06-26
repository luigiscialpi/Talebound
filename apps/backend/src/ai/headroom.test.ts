import { test } from "node:test";
import assert from "node:assert/strict";

import { compressHistory } from "./headroom.js";

test("compressHistory ritorna valori vuoti se lo storico e assente", () => {
  const result = compressHistory([]);
  assert.equal(result.compressedHistory, "");
  assert.equal(result.headroomRatio, 0);
});

test("compressHistory formatta e calcola il ratio correttamente", () => {
  const history = [
    { action: "guarda la mappa", narrative: "La mappa mostra antiche rovine nel deserto profondo." },
    { action: "cammina a nord", narrative: "Arrivi di fronte ad un portone di pietra nera con rune incise." },
  ];

  const result = compressHistory(history);
  assert.ok(result.compressedHistory.includes("T1: guarda la mappa -> La mappa mostra"));
  assert.ok(result.compressedHistory.includes("T2: cammina a nord -> Arrivi di fronte"));
  assert.ok(result.headroomRatio > 0);
  assert.ok(result.headroomRatio < 0.9);
});

test("compressHistory tronca narrative lunghe e lancia warning se ratio > 0.9", () => {
  const history = [
    {
      action: "a",
      narrative: "X".repeat(2000), // Very long narrative that will be heavily truncated
    },
  ];

  const result = compressHistory(history);
  assert.ok(result.compressedHistory.endsWith("..."));
  assert.ok(result.headroomRatio > 0.9);
});
