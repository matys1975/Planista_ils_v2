export function timeToMinutes(timeStr: string) {
    if (!timeStr) return 0;
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + m;
}

export function doTimesOverlap(s1: string, e1: string, s2: string, e2: string) {
    const start1 = timeToMinutes(s1);
    const end1 = timeToMinutes(e1);
    const start2 = timeToMinutes(s2);
    const end2 = timeToMinutes(e2);
    return start1 < end2 && end1 > start2;
}

export function doWeeksOverlap(w1: string, w2: string) {
    if (w1 === 'AB' || w2 === 'AB') return true;
    return w1 === w2;
}

export function matchesMajorFilter(major: string, filterCode: string, groupName: string = ''): boolean {
    if (!filterCode) return true;
    if (groupName && groupName.startsWith(filterCode)) return true;
    return major === filterCode;
}
