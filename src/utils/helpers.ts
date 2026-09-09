/**
 * IGNOU SC-2033 Utility Functions
 */

export function formatCurrency(amount: number): string {
  const num = Number(amount || 0);
  return `₹${num.toFixed(2)}`;
}

export function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return '—';
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    return d.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return dateString;
  }
}

export function formatDateTime(dateString: string | null | undefined): string {
  if (!dateString) return '—';
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    return d.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateString;
  }
}

/**
 * Standard IGNOU 5-Point Grading System
 * A: 80% and above (Excellent)
 * B: 60% to 79.9% (Very Good)
 * C: 50% to 59.9% (Good)
 * D: 40% to 49.9% (Satisfactory - Pass)
 * E: Below 40% (Unsatisfactory - Fail)
 */
export function calculateIGNOUGrade(marks: number | null | undefined): {
  grade: string;
  label: string;
  badgeClass: string;
} {
  if (marks === null || marks === undefined) {
    return { grade: '—', label: 'Pending', badgeClass: 'bg-zinc-100 text-zinc-600' };
  }
  const numericVal = Number(marks);
  if (isNaN(numericVal)) {
    return { grade: '—', label: 'Pending', badgeClass: 'bg-zinc-100 text-zinc-600' };
  }
  if (numericVal >= 80) {
    return { grade: 'A', label: 'Excellent', badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300' };
  }
  if (numericVal >= 60) {
    return { grade: 'B', label: 'Very Good', badgeClass: 'bg-blue-100 text-blue-800 border-blue-300' };
  }
  if (numericVal >= 50) {
    return { grade: 'C', label: 'Good', badgeClass: 'bg-amber-100 text-amber-800 border-amber-300' };
  }
  if (numericVal >= 40) {
    return { grade: 'D', label: 'Satisfactory', badgeClass: 'bg-orange-100 text-orange-800 border-orange-300' };
  }
  return { grade: 'E', label: 'Unsatisfactory / Failed', badgeClass: 'bg-rose-100 text-rose-800 border-rose-300' };
}

/**
 * Standard IGNOU grade getter alias
 */
export const getIgnouGrade = calculateIGNOUGrade;

/**
 * Generates deterministic primary key format: SUB_ENR_COURSE_TERM
 * e.g., 'SUB_2401928371_MEG01_JUL2026'
 */
export function generateDeterministicSubmissionKey(
  enrollmentNo: string,
  courseCode: string,
  session: string
): string {
  const cleanEnr = enrollmentNo.trim();
  const cleanCourse = courseCode.trim().replace(/[^a-zA-Z0-9]/g, '').toUpperCase();

  // For session like "July 2026", parts: "JUL" + "2026" => "JUL2026"
  const parts = session.trim().split(/\s+/);
  let cleanTerm = session.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  if (parts.length >= 2) {
    const month = parts[0].substring(0, 3).toUpperCase();
    const year = parts[1].length === 2 ? `20${parts[1]}` : parts[1];
    cleanTerm = `${month}${year}`;
  }
  return `SUB_${cleanEnr}_${cleanCourse}_${cleanTerm}`;
}

export function generateSessionCode(session: string): string {
  // 'July 2026' -> 'JUL26', 'Jan 2027' -> 'JAN27'
  const parts = session.trim().split(' ');
  if (parts.length >= 2) {
    const month = parts[0].substring(0, 3).toUpperCase();
    const year = parts[1].slice(-2);
    return `${month}${year}`;
  }
  return session.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
}

export function maskAccountNumber(acc: string): string {
  if (!acc || acc.length < 5) return acc;
  const lastFour = acc.slice(-4);
  return '••••••••' + lastFour;
}

export function maskPAN(pan: string): string {
  if (!pan || pan.length < 6) return pan;
  return pan.substring(0, 3) + '••••' + pan.slice(-1);
}

/**
 * Converts numerical marks (0-100) into statutory IGNOU words format:
 * e.g., 74 -> "Seventy-Four Only" or digits style "Seven Four Only"
 */
export function marksToWords(marks: number | null | undefined, style: 'cardinal' | 'digits' = 'cardinal'): string {
  if (marks === null || marks === undefined || isNaN(marks)) {
    return 'Absent (AB)';
  }
  if (marks < 0) return 'Zero Only';
  if (marks > 100) return 'One Hundred Only';
  if (marks === 0) return 'Zero Only';

  const digitWords = ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];

  if (style === 'digits') {
    const s = String(marks);
    const words = s.split('').map((ch) => digitWords[parseInt(ch, 10)]).join(' ');
    return `${words} Only`;
  }

  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
  const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  if (marks === 100) return 'One Hundred Only';
  if (marks < 10) return `${ones[marks]} Only`;
  if (marks < 20) return `${teens[marks - 10]} Only`;

  const t = Math.floor(marks / 10);
  const o = marks % 10;
  const word = o > 0 ? `${tens[t]}-${ones[o]}` : tens[t];
  return `${word} Only`;
}

/**
 * Converts currency amounts to Indian Rupees in words (e.g. 825 -> "Eight Hundred Twenty-Five Rupees Only")
 */
export function amountToIndianWords(amount: number): string {
  if (isNaN(amount) || amount <= 0) return 'Zero Rupees Only';
  
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
  const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function convertBelowThousand(n: number): string {
    let str = '';
    if (n >= 100) {
      str += ones[Math.floor(n / 100)] + ' Hundred ';
      n %= 100;
    }
    if (n >= 20) {
      str += tens[Math.floor(n / 10)] + (n % 10 > 0 ? '-' + ones[n % 10] : '') + ' ';
    } else if (n >= 10) {
      str += teens[n - 10] + ' ';
    } else if (n > 0) {
      str += ones[n] + ' ';
    }
    return str.trim();
  }

  const integerPart = Math.floor(amount);
  const paisePart = Math.round((amount - integerPart) * 100);

  const thousands = Math.floor(integerPart / 1000);
  const remainder = integerPart % 1000;

  let result = '';
  if (thousands > 0) {
    result += convertBelowThousand(thousands) + ' Thousand ';
  }
  if (remainder > 0) {
    result += convertBelowThousand(remainder) + ' ';
  }

  const rupeesStr = result.trim() ? `Rupees ${result.trim()}` : 'Rupees Zero';
  if (paisePart > 0) {
    const paiseWords = convertBelowThousand(paisePart);
    return `${rupeesStr} and ${paiseWords} Paise Only`;
  }

  return `${rupeesStr} Only`;
}
