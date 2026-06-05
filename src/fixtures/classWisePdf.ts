// Cell-for-cell transcription of the AUTHORITATIVE docs/sources/Class_Wise.pdf
// (M18). One entry per class: 6 days (Mon→Sat) × 6 periods. Each cell is
// "Subject|Teacher" using the PDF's canonical subject labels; ELGA block cells
// are "ELGA". This is the independent fixture the in-app grid is checked against
// (classWisePdf.test.ts) — the PDF is ground truth (AGENTS rule 16).

export const ELGA = "ELGA";

/** className → [day][period] (0-based day Mon..Sat, period P1..P6). */
export const CLASS_WISE_PDF: Record<string, string[][]> = {
  "Class 1": [
    ["Maths|Bindu", "EVS|Ravina", ELGA, ELGA, ELGA, "Hindi|Anjana"],
    ["Maths|Bindu", "Maths|Bindu", ELGA, ELGA, ELGA, "Hindi|Anjana"],
    ["Maths|Bindu", "EVS|Ravina", ELGA, ELGA, ELGA, "Hindi|Anjana"],
    ["Maths|Bindu", "Maths|Bindu", ELGA, ELGA, ELGA, "Hindi|Anjana"],
    ["Maths|Bindu", "Maths|Bindu", "EVS|Ravina", "EVS|Ravina", "Hindi|Anjana", "Hindi|Anjana"],
    ["Maths|Bindu", "Maths|Bindu", "EVS|Ravina", "EVS|Ravina", "CCS|Maya", "Hindi|Anjana"],
  ],
  "Class 2": [
    ["Maths|Ravina", "EVS|Bindu", ELGA, ELGA, ELGA, "Hindi|Bindu"],
    ["Maths|Ravina", "Maths|Ravina", ELGA, ELGA, ELGA, "Hindi|Bindu"],
    ["Maths|Ravina", "Hindi|Bindu", ELGA, ELGA, ELGA, "EVS|Bindu"],
    ["Maths|Ravina", "Maths|Ravina", ELGA, ELGA, ELGA, "EVS|Bindu"],
    ["Maths|Ravina", "Maths|Ravina", "EVS|Bindu", "EVS|Bindu", "Hindi|Bindu", "Hindi|Bindu"],
    ["Maths|Ravina", "Maths|Ravina", "EVS|Bindu", "EVS|Bindu", "Hindi|Bindu", "Hindi|Bindu"],
  ],
  "Class 3": [
    ["EVS|Rashmita", "EVS|Rashmita", ELGA, ELGA, ELGA, "Maths|Ravina"],
    ["EVS|Rashmita", "Hindi|Kusum", ELGA, ELGA, ELGA, "Maths|Ravina"],
    ["EVS|Rashmita", "EVS|Rashmita", ELGA, ELGA, ELGA, "Hindi|Kusum"],
    ["EVS|Rashmita", "CCS|Maya", ELGA, ELGA, ELGA, "Maths|Ravina"],
    ["EVS|Rashmita", "EVS|Rashmita", "Hindi|Kusum", "CCS|Maya", "Maths|Ravina", "Maths|Ravina"],
    ["EVS|Rashmita", "EVS|Rashmita", "Hindi|Kusum", "Hindi|Kusum", "Maths|Ravina", "Maths|Ravina"],
  ],
  "Class 4": [
    ["Hindi|Kusum", "Hindi|Kusum", ELGA, ELGA, ELGA, "Maths|Anita"],
    ["Hindi|Kusum", "Eng. Revision|Rashmita", ELGA, ELGA, ELGA, "EVS|Rashmita"],
    ["Hindi|Kusum", "Hindi|Kusum", ELGA, ELGA, ELGA, "Maths|Anita"],
    ["Hindi|Kusum", "Maths|Anita", ELGA, ELGA, ELGA, "EVS|Rashmita"],
    ["Hindi|Kusum", "Hindi|Kusum", "EVS|Rashmita", "EVS|Rashmita", "Maths|Anita", "Maths|Anita"],
    ["Hindi|Kusum", "Hindi|Kusum", "EVS|Rashmita", "EVS|Rashmita", "Eng. Revision|Kusum", "Maths|Anita"],
  ],
  "Class 5": [
    ["Maths|Nidhika", "Maths|Nidhika", ELGA, ELGA, ELGA, "Hindi|Kusum"],
    ["Maths|Nidhika", "Maths|Nidhika", ELGA, ELGA, ELGA, "EVS|Anita"],
    ["Maths|Nidhika", "EVS|Anita", ELGA, ELGA, ELGA, "CCS|Maya"],
    ["Maths|Nidhika", "Maths|Nidhika", ELGA, ELGA, ELGA, "Hindi|Kusum"],
    ["Maths|Nidhika", "EVS|Anita", "EVS|Anita", "Eng. Revision|Kusum", "Hindi|Kusum", "Hindi|Kusum"],
    ["Maths|Nidhika", "Maths|Nidhika", "Eng. Revision|Anita", "EVS|Anita", "EVS|Anita", "Hindi|Kusum"],
  ],
  "Class 6": [
    ["English|Hemlata", "CCS|Maya", "Hindi|Jainendra", "Maths|Nidhika", "Revision|Anjana", "SST|Rashmita"],
    ["English|Hemlata", "Chemistry|Hemlata", "Physics|Hemlata", "Sanskrit|Jainendra", "Revision|Anjana", "Maths|Nidhika"],
    ["Biology|Hemlata", "Sanskrit|Jainendra", "Chemistry|Hemlata", "Maths|Nidhika", "Maths|Nidhika", "English|Hemlata"],
    ["English|Hemlata", "SST|Rashmita", "Maths|Nidhika", "CCS|Maya", "Hindi|Jainendra", "Chemistry|Hemlata"],
    ["Physics|Hemlata", "Sanskrit|Jainendra", "English|Hemlata", "Hindi|Jainendra", "SST|Rashmita", "SST|Rashmita"],
    ["English|Hemlata", "English|Hemlata", "Maths|Nidhika", "Sanskrit|Jainendra", "SST|Rashmita", "SST|Rashmita"],
  ],
  "Class 7": [
    ["Maths|Anita", "Maths|Anita", "Sanskrit|Antima", "Hindi|Jainendra", "SST|Nidhika", "English|Harshita"],
    ["Maths|Anita", "Maths|Anita", "Sanskrit|Antima", "Sci. Practice|Rakesh", "SST|Nidhika", "Biology|Hemlata"],
    ["Maths|Anita", "English|Harshita", "SST|Nidhika", "Physics|Toshit", "Hindi|Jainendra", "Sanskrit|Antima"],
    ["Maths|Anita", "Hindi|Jainendra", "Sci. Practice|Rakesh", "SST|Nidhika", "Biology|Hemlata", "Sanskrit|Antima"],
    ["Maths|Anita", "CCS|Maya", "SST|Nidhika", "SST|Nidhika", "Chemistry|Hemlata", "English|Harshita"],
    ["Maths|Anita", "Maths|Anita", "Chemistry|Hemlata", "Sanskrit|Antima", "English|Harshita", "Hindi|Jainendra"],
  ],
  "Class 8": [
    ["Sanskrit|Antima", "Hindi|Jainendra", "English|Pradhyuman", "SST|Harshita", "SST|Harshita", "CCS|Maya"],
    ["Sanskrit|Antima", "Hindi|Jainendra", "Maths|Prakash", "Maths|Prakash", "English|Pradhyuman", "SST|Harshita"],
    ["Sanskrit|Antima", "Biology|Hemlata", "English|Pradhyuman", "Hindi|Jainendra", "Chemistry|Toshit", "Maths|Prakash"],
    ["Sanskrit|Antima", "Biology|Hemlata", "CCS|Maya", "English|Pradhyuman", "Revision|Anjana", "SST|Harshita"],
    ["Sanskrit|Antima", "Biology|Hemlata", "English|Pradhyuman", "Sci. Practice|Rakesh", "SST|Harshita", "Hindi|Jainendra"],
    ["Sanskrit|Antima", "Physics|Toshit", "SST|Harshita", "SST|Harshita", "Hindi|Jainendra", "English|Pradhyuman"],
  ],
  "Class 9": [
    ["Hindi|Jainendra", "Sanskrit|Antima", "Science|Toshit", "Science|Toshit", "SST Practice|Rakesh", "SST|Pradhyuman"],
    ["Hindi|Jainendra", "CCS|Maya", "Maths|Nathulal", "Sanskrit|Antima", "English|Harshita", "Hindi|Jainendra"],
    ["Hindi|Jainendra", "Revision|Maya", "English|Harshita", "English|Harshita", "Maths|Nathulal", "Science|Toshit"],
    ["Hindi|Jainendra", "Sanskrit|Antima", "SST|Pradhyuman", "English|Harshita", "English|Harshita", "Science|Toshit"],
    ["Hindi|Jainendra", "Science|Toshit", "Science|Toshit", "English|Harshita", "Sanskrit|Antima", "Maths|Nathulal"],
    ["Hindi|Jainendra", "SST|Pradhyuman", "Science|Toshit", "Sci. Practice|Rakesh", "Maths|Nathulal", "Maths|Nathulal"],
  ],
  "Class 10": [
    ["SST|Pradhyuman", "English|Harshita", "Maths|Nathulal", "Sanskrit|Antima", "Science|Toshit", "Hindi|Antima"],
    ["SST|Pradhyuman", "SST|Pradhyuman", "Science|Toshit", "Science|Toshit", "Sanskrit|Antima", "Maths|Nathulal"],
    ["SST|Pradhyuman", "Sanskrit|Antima", "Sanskrit|Antima", "Hindi|Antima", "English|Harshita", "English|Harshita"],
    ["SST|Pradhyuman", "SST|Pradhyuman", "Science|Toshit", "Hindi|Antima", "Sanskrit|Antima", "Maths|Nathulal"],
    ["SST|Pradhyuman", "Sanskrit|Antima", "English|Harshita", "Science|Toshit", "Maths|Nathulal", "Hindi|Antima"],
    ["SST|Pradhyuman", "Hindi|Antima", "Maths|Nathulal", "Maths|Nathulal", "Science|Toshit", "Sanskrit|Antima"],
  ],
  "Class 11 Arts": [
    ["Eng. Lit.|Harshita", "Economics|Prakash", "Economics|Prakash", "English|Pradhyuman", "Hindi|Jainendra", "Geography|Prakash"],
    ["Eng. Lit.|Harshita", "Geography|Prakash", "Eng. Lit.|Harshita", "Pol. Sci.|Pradhyuman", "Geography|Prakash", "Economics|Prakash"],
    ["Eng. Lit.|Harshita", "Geography|Prakash", "CCS|Maya", "Pol. Sci.|Pradhyuman", "English|Pradhyuman", "Hindi|Jainendra"],
    ["Eng. Lit.|Harshita", "Eng. Lit.|Harshita", "Geography|Prakash", "Hindi|Jainendra", "Economics|Prakash", "English|Pradhyuman"],
    ["Eng. Lit.|Harshita", "English|Pradhyuman", "Hindi|Jainendra", "Geography|Prakash", "Pol. Sci.|Pradhyuman", "Economics|Prakash"],
    ["Eng. Lit.|Harshita", "Hindi|Jainendra", "English|Pradhyuman", "Pol. Sci.|Pradhyuman", "Economics|Prakash", "Economics|Prakash"],
  ],
  "Class 11 Commerce": [
    ["Revision|Maya", "Economics|Prakash", "Economics|Prakash", "English|Pradhyuman", "Hindi|Jainendra", "B. Studies|Nidhika"],
    ["CCS|Maya", "Revision|Antima", "Revision|Maya", "Accountancy|Nathulal", "Accountancy|Nathulal", "Economics|Prakash"],
    ["Revision|Maya", "B. Studies|Nidhika", "Accountancy|Nathulal", "Revision|Maya", "English|Pradhyuman", "Hindi|Jainendra"],
    ["CCS|Maya", "Revision|Kusum", "Accountancy|Nathulal", "Accountancy|Nathulal", "Economics|Prakash", "English|Pradhyuman"],
    ["Revision|Maya", "English|Pradhyuman", "Hindi|Jainendra", "Revision|Anita", "B. Studies|Nidhika", "Economics|Prakash"],
    ["Revision|Maya", "Hindi|Jainendra", "English|Pradhyuman", "B. Studies|Nidhika", "Economics|Prakash", "Economics|Prakash"],
  ],
  "Class 11 Science": [
    ["Physics|Mahesh", "Biology|Hemlata", "Biology|Hemlata", "English|Pradhyuman", "Hindi|Jainendra", "Chemistry|Toshit"],
    ["Physics|Mahesh", "Physics|Mahesh", "Hindi|Jainendra", "Revision|Maya", "Biology|Hemlata", "Chemistry|Toshit"],
    ["Physics|Mahesh", "Physics|Mahesh", "Chemistry|Toshit", "Revision|Rakesh", "English|Pradhyuman", "Hindi|Jainendra"],
    ["Physics|Mahesh", "Physics|Mahesh", "Biology|Hemlata", "Chemistry|Toshit", "Chemistry|Toshit", "English|Pradhyuman"],
    ["Physics|Mahesh", "English|Pradhyuman", "Hindi|Jainendra", "Biology|Hemlata", "Chemistry|Toshit", "Chemistry|Toshit"],
    ["Physics|Mahesh", "Hindi|Jainendra", "English|Pradhyuman", "Biology|Hemlata", "Revision|Anjana", "Chemistry|Toshit"],
  ],
  "Class 12 Arts": [
    ["Geography|Prakash", "Pol. Sci.|Pradhyuman", "Eng. Lit.|Harshita", "Economics|Prakash", "Pol. Sci.|Pradhyuman", "Hindi|Jainendra"],
    ["Geography|Prakash", "Eng. Lit.|Harshita", "Pol. Sci.|Pradhyuman", "Eng. Lit.|Harshita", "Hindi|Jainendra", "English|Pradhyuman"],
    ["Geography|Prakash", "Pol. Sci.|Pradhyuman", "Economics|Prakash", "Geography|Prakash", "Economics|Prakash", "English|Pradhyuman"],
    ["Geography|Prakash", "Geography|Prakash", "Hindi|Jainendra", "Economics|Prakash", "English|Pradhyuman", "Hindi|Jainendra"],
    ["Geography|Prakash", "Geography|Prakash", "Economics|Prakash", "English|Pradhyuman", "Hindi|Jainendra", "Pol. Sci.|Pradhyuman"],
    ["Geography|Prakash", "Eng. Lit.|Harshita", "Economics|Prakash", "Economics|Prakash", "Pol. Sci.|Pradhyuman", "Eng. Lit.|Harshita"],
  ],
  "Class 12 Commerce": [
    ["Accountancy|Nathulal", "Accountancy|Nathulal", "B. Studies|Nidhika", "Economics|Prakash", "Economics|Prakash", "Hindi|Jainendra"],
    ["Accountancy|Nathulal", "Accountancy|Nathulal", "B. Studies|Nidhika", "B. Studies|Nidhika", "Hindi|Jainendra", "English|Pradhyuman"],
    ["Accountancy|Nathulal", "Accountancy|Nathulal", "Economics|Prakash", "Accountancy|Nathulal", "Economics|Prakash", "English|Pradhyuman"],
    ["Accountancy|Nathulal", "Accountancy|Nathulal", "Hindi|Jainendra", "Economics|Prakash", "English|Pradhyuman", "Hindi|Jainendra"],
    ["Accountancy|Nathulal", "Accountancy|Nathulal", "Economics|Prakash", "English|Pradhyuman", "Hindi|Jainendra", "B. Studies|Nidhika"],
    ["Accountancy|Nathulal", "Accountancy|Nathulal", "Economics|Prakash", "Economics|Prakash", "B. Studies|Nidhika", "B. Studies|Nidhika"],
  ],
  "Class 12 Science": [
    ["Chemistry|Toshit", "Physics|Mahesh", "Physics|Mahesh", "Biology|Hemlata", "Biology|Hemlata", "Hindi|Jainendra"],
    ["Chemistry|Toshit", "Chemistry|Toshit", "Physics|Mahesh", "Biology|Hemlata", "Hindi|Jainendra", "English|Pradhyuman"],
    ["Chemistry|Toshit", "Chemistry|Toshit", "Physics|Mahesh", "Biology|Hemlata", "Biology|Hemlata", "English|Pradhyuman"],
    ["Chemistry|Toshit", "Chemistry|Toshit", "Physics|Mahesh", "Biology|Hemlata", "English|Pradhyuman", "Hindi|Jainendra"],
    ["Chemistry|Toshit", "Physics|Mahesh", "Physics|Mahesh", "English|Pradhyuman", "Hindi|Jainendra", "Biology|Hemlata"],
    ["Chemistry|Toshit", "Physics|Mahesh", "Physics|Mahesh", "Chemistry|Toshit", "Biology|Hemlata", "Biology|Hemlata"],
  ],
};
