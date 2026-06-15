export async function fetchEntries(semesterId: string) {
    if (!semesterId) return { data: [] };
    const res = await fetch(`/api/v1/entries?semesterId=${semesterId}`);
    if (!res.ok) throw new Error('Error fetching entries');
    return res.json();
}

export async function fetchDictionaries() {
    const [semesters, courses, teachers, rooms, groups, majors] = await Promise.all([
        fetch('/api/v1/semesters').then(res => res.json()),
        fetch('/api/v1/courses').then(res => res.json()),
        fetch('/api/v1/teachers').then(res => res.json()),
        fetch('/api/v1/rooms').then(res => res.json()),
        fetch('/api/v1/groups').then(res => res.json()),
        fetch('/api/v1/majors').then(res => res.json()),
    ]);
    return {
        semesters: semesters.data,
        courses: courses.data,
        teachers: teachers.data,
        rooms: rooms.data,
        groups: groups.data,
        majors: majors.data
    };
}
