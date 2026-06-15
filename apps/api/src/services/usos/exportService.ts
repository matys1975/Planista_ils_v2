import { USOSClient } from './usosClient';
import { prisma } from '../../lib/prisma';

export class USOSExportService {
  private client: USOSClient;

  constructor() {
    this.client = new USOSClient();
  }

  /**
   * Główna metoda eksportu planu dla danego semestru
   */
  async exportSemesterPlan(semesterId: string) {
    // 1. Pobierz wszystkie wpisy w planie dla danego semestru
    const scheduleEntries = await prisma.scheduleEntry.findMany({
      where: { semesterId },
      include: {
        course: true,
        teacher: true,
        room: true,
      }
    });

    const results = {
      success: 0,
      failed: 0,
      errors: [] as string[],
    };

    for (const entry of scheduleEntries) {
      try {
        await this.syncEntryWithUSOS(entry);
        results.success++;
      } catch (error: any) {
        results.failed++;
        results.errors.push(`Błąd przy wpisie ${entry.id}: ${error.message}`);
      }
    }

    return results;
  }

  /**
   * Synchronizuje pojedynczy wpis z USOS
   * UWAGA: Metody 'services/groups/...' i 'services/tt/...' są przykładowe 
   * i muszą zostać zweryfikowane w Twoim Fiddlerze USOS.
   */
  private async syncEntryWithUSOS(entry: any) {
    const { course, teacher, room, startTime, endTime, dayOfWeek } = entry;
    
    // USOS wymaga specyficznych ID. Załóżmy, że przechowujemy je w polach 'usosId'
    const courseId = course.usosId;
    const lecturerId = teacher.usosId;
    const roomId = room?.usosId;

    if (!courseId || !lecturerId) {
      throw new Error('Brak zmapowanego ID kursu lub prowadzącego w USOS');
    }

    // 1. Upewnij się, że grupa istnieje (przykładowa metoda)
    // const groupInfo = await this.client.request('POST', 'services/groups/ensure_group', {
    //   course_unit_id: course.usosUnitId,
    //   group_number: 1, // Tutaj musisz dodać logikę pobierania numeru grupy
    // });

    // 2. Dodaj termin zajęć (przykładowa metoda zapisu terminu)
    // Parametry typowe dla USOS:
    // t_start: "HH:MM", t_end: "HH:MM", day: 1-7, frequency: "every_week"
    await this.client.request('POST', 'services/tt/add_classgroup_meeting', {
      course_unit_id: course.usosUnitId,
      group_number: 1, // Logika nr grupy
      room_id: roomId,
      lecturer_id: lecturerId,
      day_of_week: dayOfWeek,
      start_time: startTime, // format "HH:MM"
      end_time: endTime,
      frequency: 'every_week',
    });
  }
}
