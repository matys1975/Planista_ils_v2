import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Settings, CalendarDays, GraduationCap, Users2, Plus, Building2, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSearch } from '@tanstack/react-router';


// Import features/components from existing modules
import { DictionarySemestersPage } from '@/features/dictionary/semesters';
import { DictionaryMajors } from './DictionaryMajors';
import { DictionaryGroups } from './DictionaryGroups';
import { DictionaryRooms } from './DictionaryRooms';
import { fetchApi } from '../lib/api';
import { useAuthStore } from '../store/auth';

export function Configuration() {
  const searchParams = useSearch({ strict: false }) as { tab?: string };
  const validTabs = ['semesters', 'majors', 'groups', 'rooms'];
  const [activeTab, setActiveTab] = useState(
    searchParams?.tab && validTabs.includes(searchParams.tab) ? searchParams.tab : 'semesters'
  );

  // Sync tab when navigating from homepage tiles
  useEffect(() => {
    if (searchParams?.tab && validTabs.includes(searchParams.tab)) {
      setActiveTab(searchParams.tab);
    }
  }, [searchParams?.tab]);
  const queryClient = useQueryClient();
  const { role } = useAuthStore();

  // Institute filter — only for DEAN and SUPER_ADMIN
  const showInstituteFilter = role === 'DEAN' || role === 'SUPER_ADMIN';
  const [selectedInstituteId, setSelectedInstituteId] = useState<string>('all');

  const { data: institutesData } = useQuery({
    queryKey: ['institutes'],
    queryFn: () => fetchApi('/institutes'),
    enabled: showInstituteFilter,
  });

  const institutes = institutesData?.data || [];

  // Queries for stats
  const { data: semestersData } = useQuery({ queryKey: ['semesters'], queryFn: () => fetchApi('/semesters') });
  const { data: majorsData } = useQuery({ queryKey: ['majors'], queryFn: () => fetchApi('/majors') });
  const { data: groupsData } = useQuery({ queryKey: ['groups'], queryFn: () => fetchApi('/groups') });
  const { data: roomsData } = useQuery({ queryKey: ['rooms'], queryFn: () => fetchApi('/rooms') });

  // Filter counts for pills
  const filteredMajorsCount = selectedInstituteId === 'all'
    ? (majorsData?.data?.length || 0)
    : (majorsData?.data?.filter((m: any) => m.instituteId === selectedInstituteId).length || 0);
  const filteredGroupsCount = selectedInstituteId === 'all'
    ? (groupsData?.data?.length || 0)
    : (groupsData?.data?.filter((g: any) => g.instituteId === selectedInstituteId).length || 0);
  const filteredRoomsCount = selectedInstituteId === 'all'
    ? (roomsData?.data?.length || 0)
    : (roomsData?.data?.filter((r: any) => r.instituteId === selectedInstituteId).length || 0);

  return (
    <div className="space-y-4 p-4 sm:p-6 animate-in fade-in duration-500">
      {/* ─── COMPACT CONFIGURATION HEADER ─── */}
      <div className="flex flex-col sm:flex-row justify-between items-center bg-card px-4 py-3 rounded-xl border border-border/50 shadow-sm gap-4 print:hidden">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="p-2 bg-primary rounded-lg shadow-lg">
            <Settings className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">Konfiguracja Systemu</h1>
            <p className="text-[10px] text-muted-foreground uppercase font-semibold tracking-widest leading-none mt-1">Zarządzanie strukturą i semestrami</p>
          </div>

          <div className="h-6 w-[1px] bg-border mx-2 hidden sm:block" />

          {/* Custom Tab Switcher */}
          <div className="flex bg-muted/50 p-1 h-9 rounded-lg border gap-1 overflow-x-auto scrollbar-hide">
            <button
              onClick={() => setActiveTab('semesters')}
              className={`flex items-center px-4 rounded-md text-[10px] font-bold uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === 'semesters' ? 'bg-white shadow-sm text-primary' : 'text-muted-foreground hover:bg-muted'
                }`}
            >
              <CalendarDays className="h-3 w-3 mr-2" /> Semestry
            </button>
            <button
              onClick={() => setActiveTab('majors')}
              className={`flex items-center px-4 rounded-md text-[10px] font-bold uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === 'majors' ? 'bg-white shadow-sm text-primary' : 'text-muted-foreground hover:bg-muted'
                }`}
            >
              <GraduationCap className="h-3 w-3 mr-2" /> Kierunki
            </button>
            <button
              onClick={() => setActiveTab('groups')}
              className={`flex items-center px-4 rounded-md text-[10px] font-bold uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === 'groups' ? 'bg-white shadow-sm text-primary' : 'text-muted-foreground hover:bg-muted'
                }`}
            >
              <Users2 className="h-3 w-3 mr-2" /> Grupy
            </button>
            <button
              onClick={() => setActiveTab('rooms')}
              className={`flex items-center px-4 rounded-md text-[10px] font-bold uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === 'rooms' ? 'bg-white shadow-sm text-primary' : 'text-muted-foreground hover:bg-muted'
                }`}
            >
              <Building2 className="h-3 w-3 mr-2" /> Sale
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Institute Filter — only for DEAN / SUPER_ADMIN */}
          {showInstituteFilter && activeTab !== 'semesters' && (
            <div className="flex items-center gap-2 bg-muted/30 border border-border/50 rounded-lg px-3 py-1.5">
              <Filter className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
              <select
                value={selectedInstituteId}
                onChange={(e) => setSelectedInstituteId(e.target.value)}
                className="bg-transparent text-xs font-semibold text-foreground border-none outline-none cursor-pointer pr-1 appearance-none"
                style={{ backgroundImage: 'none' }}
              >
                <option value="all">Wszystkie jednostki</option>
                {institutes.map((inst: any) => (
                  <option key={inst.id} value={inst.id}>
                    {inst.shortCode ? `${inst.shortCode} — ${inst.name}` : inst.name}
                  </option>
                ))}
              </select>
              {selectedInstituteId !== 'all' && (
                <button
                  onClick={() => setSelectedInstituteId('all')}
                  className="text-[10px] font-bold text-primary hover:text-primary/80 transition-colors whitespace-nowrap"
                >
                  ✕
                </button>
              )}
            </div>
          )}

          {/* Dynamic Context Pills based on active tab */}
          <div className="flex items-center gap-1.5">
            {activeTab === 'semesters' && (
              <StatPill count={semestersData?.data?.length || 0} label="Semestry" color="text-primary" bgColor="bg-primary/10" />
            )}
            {activeTab === 'majors' && (
              <StatPill count={filteredMajorsCount} label="Kierunki" color="text-status-active-fg" bgColor="bg-status-active-bg" />
            )}
            {activeTab === 'groups' && (
              <StatPill count={filteredGroupsCount} label="Grupy" color="text-status-warning-fg" bgColor="bg-status-warning-bg" />
            )}
            {activeTab === 'rooms' && (
              <StatPill count={filteredRoomsCount} label="Sale" color="text-navy-mid" bgColor="bg-status-info-bg" />
            )}
          </div>
        </div>
      </div>

      {/* ─── TAB CONTENT ─── */}
      <div className="animate-in fade-in duration-500">
        {activeTab === 'semesters' && <DictionarySemestersPage />}
        {activeTab === 'majors' && <DictionaryMajorsView instituteId={selectedInstituteId === 'all' ? undefined : selectedInstituteId} />}
        {activeTab === 'groups' && <DictionaryGroupsView instituteId={selectedInstituteId === 'all' ? undefined : selectedInstituteId} />}
        {activeTab === 'rooms' && <DictionaryRoomsView instituteId={selectedInstituteId === 'all' ? undefined : selectedInstituteId} />}
      </div>
    </div>
  );
}

// ─── Sub-views wrapped with the same compact style ───
// These will eventually replace the original pages entirely

function DictionaryMajorsView({ instituteId }: { instituteId?: string }) {
  return (
    <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
      <DictionaryMajors hideHeader filterInstituteId={instituteId} />
    </div>
  );
}

function DictionaryGroupsView({ instituteId }: { instituteId?: string }) {
  return (
    <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
      <DictionaryGroups hideHeader filterInstituteId={instituteId} />
    </div>
  );
}

function DictionaryRoomsView({ instituteId }: { instituteId?: string }) {
  return (
    <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
      <DictionaryRooms hideHeader filterInstituteId={instituteId} />
    </div>
  );
}

function StatPill({ count, label, color, bgColor }: { count: number, label: string, color: string, bgColor: string }) {
  return (
    <div className={`flex items-center gap-2 px-3 py-1 rounded-full border border-border/50 ${bgColor}`}>
      <span className={`text-xs font-black ${color}`}>{count}</span>
      <span className="text-[9px] uppercase font-bold text-muted-foreground tracking-tight">{label}</span>
    </div>
  );
}
