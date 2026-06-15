const { PrismaClient } = require('/app/packages/database/node_modules/@prisma/client');

async function run() {
  const isDryRun = !process.argv.includes('--write');

  console.log("=========================================");
  console.log(isDryRun ? "RUNNING IN DRY-RUN MODE (NO WRITES)" : "RUNNING IN WRITE MODE (DATA WILL BE MERGED)");
  console.log("=========================================\n");

  const currentDb = new PrismaClient({
    datasources: { db: { url: "postgresql://admin:password123@planista_ils_v2-postgres-1:5432/plan_db" } }
  });

  const backupDb = new PrismaClient({
    datasources: { db: { url: "postgresql://admin:password123@planista_ils_v2-postgres-1:5432/plan_db_backup" } }
  });

  try {
    const currentIlsId = "5a716ec2-65b6-4183-a901-bec14a4451e3";

    // 1. Fetch data from backup DB
    console.log("Reading data from backup database...");
    
    const backupTeachers = await backupDb.$queryRawUnsafe(
      `SELECT * FROM "Teacher" WHERE "instituteId" = $1`, currentIlsId
    );
    const backupCourses = await backupDb.$queryRawUnsafe(
      `SELECT * FROM "Course" WHERE "instituteId" = $1`, currentIlsId
    );
    
    // We only care about allocations related to ILS courses or ILS teachers in the backup
    const backupAllocations = await backupDb.$queryRawUnsafe(
      `SELECT * FROM "CourseAllocation"`
    );
    
    // CourseOnMajor relations
    const backupCourseOnMajors = await backupDb.$queryRawUnsafe(
      `SELECT * FROM "CourseOnMajor"`
    );

    console.log(`Loaded from Backup: ${backupTeachers.length} teachers, ${backupCourses.length} courses, ${backupAllocations.length} total allocations.`);

    // 2. Fetch existing data from current DB for checks
    const currentTeachers = await currentDb.teacher.findMany();
    const currentCourses = await currentDb.course.findMany();
    const currentAllocations = await currentDb.courseAllocation.findMany();
    const currentCourseOnMajors = await currentDb.courseOnMajor.findMany();

    const currentTeacherEmails = new Set(currentTeachers.map(t => t.email.toLowerCase()));
    
    // Create maps of current course ID and code to resolve conflicts
    const currentCoursesById = new Map(currentCourses.map(c => [c.id, c]));
    const currentCourseKeys = new Set(currentCourses.map(c => `${c.code.toLowerCase()}_${c.semesterId}`));
    
    const currentAllocIds = new Set(currentAllocations.map(a => a.id));
    const currentComKeys = new Set(currentCourseOnMajors.map(com => `${com.courseId}_${com.majorId}_${com.year}`));

    // Track statistics
    let teachersAdded = 0;
    let coursesAdded = 0;
    let coursesUpdated = 0;
    let allocationsAdded = 0;
    let comAdded = 0;

    // 3. Process Teachers
    console.log("\n--- Processing Teachers ---");
    for (const t of backupTeachers) {
      if (!currentTeacherEmails.has(t.email.toLowerCase())) {
        console.log(`[TEACHER] Will add: ${t.title} ${t.firstName} ${t.lastName} (${t.email})`);
        teachersAdded++;
        if (!isDryRun) {
          await currentDb.teacher.create({
            data: {
              id: t.id,
              firstName: t.firstName,
              lastName: t.lastName,
              title: t.title,
              email: t.email,
              unit: t.unit,
              pensumLimit: t.pensumLimit,
              version: t.version,
              instituteId: currentIlsId
            }
          });
        }
      }
    }

    // 4. Process Courses (using Upsert by ID)
    console.log("\n--- Processing Courses ---");
    for (const c of backupCourses) {
      const existingCourse = currentCoursesById.get(c.id);
      
      if (existingCourse) {
        // Course exists with the same ID. Check if properties have changed
        if (existingCourse.code !== c.code || existingCourse.type !== c.type) {
          console.log(`[COURSE] Will update existing course ID ${c.id}: "${existingCourse.code}" (${existingCourse.type}) -> "${c.code}" (${c.type})`);
          coursesUpdated++;
          if (!isDryRun) {
            await currentDb.course.update({
              where: { id: c.id },
              data: {
                code: c.code,
                name: c.name,
                type: c.type,
                ectsCredits: c.ectsCredits,
                hoursTotal: c.hoursTotal,
                targetGroupsCount: c.targetGroupsCount,
                version: c.version,
                usosId: c.usosId,
                usosUnitId: c.usosUnitId
              }
            });
          }
        }
      } else {
        // Course does not exist. Check if code + semesterId is unique
        const key = `${c.code.toLowerCase()}_${c.semesterId}`;
        if (!currentCourseKeys.has(key)) {
          console.log(`[COURSE] Will add new course: [${c.code}] ${c.name} (${c.type})`);
          coursesAdded++;
          if (!isDryRun) {
            await currentDb.course.create({
              data: {
                id: c.id,
                code: c.code,
                name: c.name,
                type: c.type,
                ectsCredits: c.ectsCredits,
                hoursTotal: c.hoursTotal,
                targetGroupsCount: c.targetGroupsCount,
                semesterId: c.semesterId,
                version: c.version,
                instituteId: currentIlsId,
                usosId: c.usosId,
                usosUnitId: c.usosUnitId
              }
            });
          }
        }
      }
    }

    // 5. Process CourseOnMajor relations
    console.log("\n--- Processing CourseOnMajor Relations ---");
    const backupIlsCourseIds = new Set(backupCourses.map(c => c.id));
    for (const com of backupCourseOnMajors) {
      if (backupIlsCourseIds.has(com.courseId)) {
        const key = `${com.courseId}_${com.majorId}_${com.year}`;
        if (!currentComKeys.has(key)) {
          console.log(`[COURSE-ON-MAJOR] Will add link: Course ID ${com.courseId} -> Major ID ${com.majorId}, Year ${com.year}`);
          comAdded++;
          if (!isDryRun) {
            await currentDb.courseOnMajor.create({
              data: {
                courseId: com.courseId,
                majorId: com.majorId,
                year: com.year
              }
            });
          }
        }
      }
    }

    // 6. Process CourseAllocations
    console.log("\n--- Processing CourseAllocations ---");
    const backupIlsTeacherIds = new Set(backupTeachers.map(t => t.id));
    for (const a of backupAllocations) {
      if (backupIlsCourseIds.has(a.courseId) || backupIlsTeacherIds.has(a.teacherId)) {
        if (!currentAllocIds.has(a.id)) {
          console.log(`[ALLOCATION] Will add: Alloc ID ${a.id} (Teacher ID: ${a.teacherId}, Course ID: ${a.courseId}, Hours: ${a.assignedHours})`);
          allocationsAdded++;
          if (!isDryRun) {
            await currentDb.courseAllocation.create({
              data: {
                id: a.id,
                courseId: a.courseId,
                teacherId: a.teacherId,
                assignedHours: a.assignedHours,
                classType: a.classType,
                instituteId: currentIlsId
              }
            });
          }
        }
      }
    }

    console.log("\n=========================================");
    console.log("Migration Summary:");
    console.log(`Teachers:      ${teachersAdded} proposed to add`);
    console.log(`Courses (New): ${coursesAdded} proposed to add`);
    console.log(`Courses (Upd): ${coursesUpdated} proposed to update`);
    console.log(`CourseMajors:  ${comAdded} proposed to add`);
    console.log(`Allocations:   ${allocationsAdded} proposed to add`);
    console.log("=========================================");

  } catch (error) {
    console.error("Error during merge script execution:", error);
  } finally {
    await currentDb.$disconnect();
    await backupDb.$disconnect();
  }
}

run();
