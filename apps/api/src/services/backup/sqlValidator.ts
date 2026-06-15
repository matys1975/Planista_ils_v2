// ── Audyt #7: Deny-lista SQL — blokuj destrukcyjne komendy w plikach restore ──
const SQL_DENY_PATTERNS: RegExp[] = [
    /\bDROP\s+DATABASE\b/i,
    /\bCREATE\s+USER\b/i,
    /\bGRANT\s+ALL\b/i,
    /\bALTER\s+USER\b/i,
    /\bCREATE\s+ROLE\b/i,
    /\bDROP\s+ROLE\b/i,
    /\bCOPY\s+.*\bFROM\s+PROGRAM\b/i,
    /\bpg_read_file\b/i,
    /\bpg_write_file\b/i,
];

/**
 * Waliduje treść SQL — sprawdza czy nie zawiera destrukcyjnych komend.
 * Zwraca listę znalezionych naruszeń.
 */
export function validateSqlContent(sql: string): string[] {
    const violations: string[] = [];
    for (const pattern of SQL_DENY_PATTERNS) {
        const match = sql.match(pattern);
        if (match) {
            violations.push(`Zabroniona komenda SQL: "${match[0]}"`);
        }
    }
    return violations;
}
