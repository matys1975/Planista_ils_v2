import { MAJORS } from '../constants/majors';

export function parseCourseCode(code: string): { major: string | null; studySemester: number | null; majorLabel: string | null; studyYear: number | null } {
  if (!code) return { major: null, studySemester: null, majorLabel: null, studyYear: null };
  
  // Szukaj wzorca S1/S2 + kod kierunku + numer semestru
  const match = code.match(/S([12])(LSN|LSA|LSlk|LSal|LSel)0*(\d+)/);
  if (!match) return { major: null, studySemester: null, majorLabel: null, studyYear: null };
  
  const level = match[1]; // 1 lub 2
  const majorPattern = match[2]; // LSA, LSN, etc.
  const semester = parseInt(match[3], 10); // numer semestru
  
  const majorCode = `S${level}-${majorPattern}`;
  const majorObj = MAJORS.find(m => m.code === majorCode);
  
  return {
    major: majorCode,
    studySemester: semester,
    majorLabel: majorObj?.longLabel || majorCode,
    studyYear: Math.ceil(semester / 2)
  };
}
