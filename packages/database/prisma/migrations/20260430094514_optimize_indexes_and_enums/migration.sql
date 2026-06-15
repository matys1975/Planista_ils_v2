-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'PLANNER', 'VIEWER');

-- CreateEnum
CREATE TYPE "WeekType" AS ENUM ('A', 'B', 'AB');

-- CreateTable
CREATE TABLE "Semester" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "dateStart" TIMESTAMP(3) NOT NULL,
    "dateEnd" TIMESTAMP(3) NOT NULL,
    "isLocked" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Semester_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'VIEWER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Course" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "ectsCredits" INTEGER NOT NULL,
    "hoursTotal" INTEGER NOT NULL DEFAULT 0,
    "targetGroupsCount" INTEGER NOT NULL DEFAULT 1,
    "semesterId" TEXT NOT NULL,

    CONSTRAINT "Course_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseOnMajor" (
    "courseId" TEXT NOT NULL,
    "majorId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,

    CONSTRAINT "CourseOnMajor_pkey" PRIMARY KEY ("courseId","majorId","year")
);

-- CreateTable
CREATE TABLE "Teacher" (
    "id" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'Instytut Lingwistyki Stosowanej',
    "pensumLimit" INTEGER NOT NULL DEFAULT 210,

    CONSTRAINT "Teacher_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Room" (
    "id" TEXT NOT NULL,
    "building" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "equipment" TEXT[],

    CONSTRAINT "Room_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Group" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "major" TEXT NOT NULL,
    "degree" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "size" INTEGER NOT NULL,
    "semesterId" TEXT NOT NULL,

    CONSTRAINT "Group_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduleEntryGroup" (
    "entryId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,

    CONSTRAINT "ScheduleEntryGroup_pkey" PRIMARY KEY ("entryId","groupId")
);

-- CreateTable
CREATE TABLE "ScheduleEntry" (
    "id" TEXT NOT NULL,
    "semesterId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "weekType" "WeekType" NOT NULL DEFAULT 'AB',
    "isRecurring" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ScheduleEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseAllocation" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "assignedHours" INTEGER NOT NULL DEFAULT 30,

    CONSTRAINT "CourseAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseAllocationGroup" (
    "allocationId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,

    CONSTRAINT "CourseAllocationGroup_pkey" PRIMARY KEY ("allocationId","groupId")
);

-- CreateTable
CREATE TABLE "Major" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "degree" TEXT NOT NULL,
    "years" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Major_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Course_code_key" ON "Course"("code");

-- CreateIndex
CREATE INDEX "Course_semesterId_idx" ON "Course"("semesterId");

-- CreateIndex
CREATE INDEX "CourseOnMajor_courseId_idx" ON "CourseOnMajor"("courseId");

-- CreateIndex
CREATE INDEX "CourseOnMajor_majorId_year_idx" ON "CourseOnMajor"("majorId", "year");

-- CreateIndex
CREATE UNIQUE INDEX "Teacher_email_key" ON "Teacher"("email");

-- CreateIndex
CREATE INDEX "Teacher_lastName_idx" ON "Teacher"("lastName");

-- CreateIndex
CREATE INDEX "Group_semesterId_idx" ON "Group"("semesterId");

-- CreateIndex
CREATE INDEX "Group_major_year_name_idx" ON "Group"("major", "year", "name");

-- CreateIndex
CREATE INDEX "ScheduleEntryGroup_groupId_idx" ON "ScheduleEntryGroup"("groupId");

-- CreateIndex
CREATE INDEX "ScheduleEntry_semesterId_dayOfWeek_roomId_teacherId_idx" ON "ScheduleEntry"("semesterId", "dayOfWeek", "roomId", "teacherId");

-- CreateIndex
CREATE INDEX "ScheduleEntry_teacherId_idx" ON "ScheduleEntry"("teacherId");

-- CreateIndex
CREATE INDEX "ScheduleEntry_roomId_idx" ON "ScheduleEntry"("roomId");

-- CreateIndex
CREATE INDEX "ScheduleEntry_courseId_idx" ON "ScheduleEntry"("courseId");

-- CreateIndex
CREATE INDEX "CourseAllocation_teacherId_idx" ON "CourseAllocation"("teacherId");

-- CreateIndex
CREATE UNIQUE INDEX "CourseAllocation_courseId_teacherId_key" ON "CourseAllocation"("courseId", "teacherId");

-- CreateIndex
CREATE INDEX "CourseAllocationGroup_groupId_idx" ON "CourseAllocationGroup"("groupId");

-- CreateIndex
CREATE UNIQUE INDEX "Major_code_key" ON "Major"("code");

-- AddForeignKey
ALTER TABLE "Course" ADD CONSTRAINT "Course_semesterId_fkey" FOREIGN KEY ("semesterId") REFERENCES "Semester"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseOnMajor" ADD CONSTRAINT "CourseOnMajor_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseOnMajor" ADD CONSTRAINT "CourseOnMajor_majorId_fkey" FOREIGN KEY ("majorId") REFERENCES "Major"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Group" ADD CONSTRAINT "Group_semesterId_fkey" FOREIGN KEY ("semesterId") REFERENCES "Semester"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleEntryGroup" ADD CONSTRAINT "ScheduleEntryGroup_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "ScheduleEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleEntryGroup" ADD CONSTRAINT "ScheduleEntryGroup_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleEntry" ADD CONSTRAINT "ScheduleEntry_semesterId_fkey" FOREIGN KEY ("semesterId") REFERENCES "Semester"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleEntry" ADD CONSTRAINT "ScheduleEntry_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleEntry" ADD CONSTRAINT "ScheduleEntry_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleEntry" ADD CONSTRAINT "ScheduleEntry_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseAllocation" ADD CONSTRAINT "CourseAllocation_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseAllocation" ADD CONSTRAINT "CourseAllocation_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseAllocationGroup" ADD CONSTRAINT "CourseAllocationGroup_allocationId_fkey" FOREIGN KEY ("allocationId") REFERENCES "CourseAllocation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseAllocationGroup" ADD CONSTRAINT "CourseAllocationGroup_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;
