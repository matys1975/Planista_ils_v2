import { prisma } from '../lib/prisma';

export interface ImporterData {
  instituteName: string;
  teachers: { email: string; firstName: string; lastName: string; title: string; pensumLimit?: number }[];
  courses: { code: string; name: string; type: string; ectsCredits: number; hoursTotal: number; semesterId: string }[];
}

export async function importInstituteData(data: ImporterData) {
  // 1. Create or connect Institute
  let institute = await prisma.institute.findFirst({ where: { name: data.instituteName } });
  if (!institute) {
    institute = await prisma.institute.create({ data: { name: data.instituteName } });
  }

  const results = {
    instituteId: institute.id,
    teachersCreated: 0,
    teachersUpdated: 0,
    coursesCreated: 0,
    coursesUpdated: 0,
  };

  // 2. Import Teachers
  for (const t of data.teachers) {
    const existing = await prisma.teacher.findUnique({ where: { email: t.email } });
    if (existing) {
      await prisma.teacher.update({
        where: { id: existing.id },
        data: {
          firstName: t.firstName,
          lastName: t.lastName,
          title: t.title,
          pensumLimit: t.pensumLimit ?? existing.pensumLimit,
          instituteId: institute.id,
        }
      });
      results.teachersUpdated++;
    } else {
      await prisma.teacher.create({
        data: {
          ...t,
          unit: data.instituteName,
          instituteId: institute.id,
        }
      });
      results.teachersCreated++;
    }
  }

  // 3. Import Courses
  for (const c of data.courses) {
    const existing = await prisma.course.findUnique({ 
      where: { 
        code_semesterId: { 
          code: c.code, 
          semesterId: c.semesterId 
        } 
      } 
    });
    if (existing) {
      await prisma.course.update({
        where: { id: existing.id },
        data: {
          name: c.name,
          type: c.type,
          ectsCredits: c.ectsCredits,
          hoursTotal: c.hoursTotal,
          instituteId: institute.id,
        }
      });
      results.coursesUpdated++;
    } else {
      await prisma.course.create({
        data: {
          ...c,
          instituteId: institute.id,
        }
      });
      results.coursesCreated++;
    }
  }

  return results;
}
