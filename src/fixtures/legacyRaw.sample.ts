// A faithful synthetic snapshot of the legacy viewer's rawData text.
// NOT real VPPS data — a hand-written fixture (AGENTS.md §2) in the exact
// canonical format `exportLegacyRawData` emits, so the M1 round-trip test
// (import → export → compare) is an independent string check, not a tautology.
//
// Exercises: ELGA detected as one atomic 3-period block (P3–P5) across the 5
// primary classes with 5 teachers, on two days (block-signature reuse);
// multi-teacher-free single lessons; middle + senior classes; `Free` cells.

const ELGA = "ELGA (Bindu / Anita / Rashmita / Kusum / Ravina)";

const day = (name: string): string =>
  [
    name,
    "Class,Period 1,Period 2,Period 3,Period 4,Period 5,Period 6",
    `Class 1,Maths (Bindu),Hindi (Anita),${ELGA},${ELGA},${ELGA},EVS (Ravina)`,
    `Class 2,Maths (Anita),Hindi (Rashmita),${ELGA},${ELGA},${ELGA},EVS (Bindu)`,
    `Class 3,Maths (Rashmita),Hindi (Kusum),${ELGA},${ELGA},${ELGA},EVS (Anita)`,
    `Class 4,Maths (Kusum),Hindi (Ravina),${ELGA},${ELGA},${ELGA},EVS (Rashmita)`,
    `Class 5,Maths (Ravina),Hindi (Bindu),${ELGA},${ELGA},${ELGA},EVS (Kusum)`,
    "Class 7,Maths (Nidhika),Science (Mahesh),Hindi (Anjana),English (Harshita),Social Science (Toshit),Maths (Nidhika)",
    "Class 11 Science,Physics (Pradhyuman),Chemistry (Prakash),Biology (Jainendra),Maths (Rakesh),English (Hemlata),Free",
  ].join("\n");

export const legacyRawSample = [day("Monday"), day("Tuesday")].join("\n");
