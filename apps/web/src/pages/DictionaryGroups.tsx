import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Users2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Group } from '../types/models';
import { fetchApi } from '../lib/api';
import { MAJORS } from '../constants/majors';
import { GroupFormDialog, type GroupFormData } from '../components/groups/GroupFormDialog';
import { GroupsTable } from '../components/groups/GroupsTable';

const fetchGroups = () => fetchApi('/groups');
const fetchSemesters = () => fetchApi('/semesters');
const fetchMajors = () => fetchApi('/majors');
const createGroup = (data: GroupFormData) => fetchApi('/groups', { method: 'POST', body: JSON.stringify(data) });
const deleteGroup = (id: string) => fetchApi(`/groups/${id}`, { method: 'DELETE' });

export function DictionaryGroups({ hideHeader, filterInstituteId }: { hideHeader?: boolean; filterInstituteId?: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);
  const [activeMajorTab, setActiveMajorTab] = useState<string>('');
  const [activeYearTab, setActiveYearTab] = useState<string>('all');
  const queryClient = useQueryClient();

  const { data: groupsData, isLoading: isLoadingGroups } = useQuery({ queryKey: ['groups'], queryFn: fetchGroups });
  const { data: semestersData } = useQuery({ queryKey: ['semesters'], queryFn: fetchSemesters });
  const { data: majorsData } = useQuery({ queryKey: ['majors'], queryFn: fetchMajors });

  const invalidateGroups = () => {
    queryClient.invalidateQueries({ queryKey: ['groups'] });
    queryClient.invalidateQueries({ queryKey: ['dictionaries'] });
  };

  const createMutation = useMutation({
    mutationFn: createGroup,
    onSuccess: () => { invalidateGroups(); setIsOpen(false); },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: GroupFormData & { id: string }) => {
      const { id, ...payload } = data;
      return fetchApi(`/groups/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
    },
    onSuccess: () => { invalidateGroups(); setIsOpen(false); setEditingGroup(null); },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteGroup,
    onSuccess: invalidateGroups,
  });

  const handleFormSubmit = (data: GroupFormData) => {
    if (editingGroup) {
      updateMutation.mutate({ ...data, id: editingGroup.id });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleDuplicate = (group: any) => {
    const nextName = group.name.replace(/(\d+)(?!.*\d)/, (match: string) => String(parseInt(match) + 1));
    const finalName = nextName === group.name ? `${group.name} 2` : nextName;
    createMutation.mutate({
      name: finalName,
      majorId: group.majorId,
      degree: group.degree,
      year: group.year,
      size: group.studentCount || group.size,
      semesterId: group.semesterId,
    });
  };

  const openCreate = () => { setEditingGroup(null); setIsOpen(true); };
  const openEdit = (group: Group) => { setEditingGroup(group); setIsOpen(true); };

  return (
    <div className="space-y-6">
      {!hideHeader && (
        <div className="flex justify-between items-center bg-card p-6 rounded-xl border shadow-sm">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-primary/10 rounded-lg">
              <Users2 className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Grupy studenckie</h1>
              <p className="text-muted-foreground text-sm">Zarządzaj potokami i grupami z podziałem na semestry</p>
            </div>
          </div>

          <Button className="gap-2" onClick={openCreate}>
            <Plus className="h-4 w-4" /> Dodaj grupę
          </Button>
        </div>
      )}

      {/* Action bar for embedded mode */}
      {hideHeader && (
        <div className="flex justify-between items-center px-4 py-2 bg-muted/10 border-b">
          <div className="flex items-center gap-2">
            <Users2 className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs font-black uppercase tracking-wider">Grupy</span>
          </div>
          <Button size="sm" className="h-7 text-[10px] font-black px-3 gap-1 bg-primary" onClick={openCreate}>
            <Plus className="h-3 w-3" /> DODAJ GRUPĘ
          </Button>
        </div>
      )}

      <div className="bg-card rounded-xl border shadow-sm">
        <div className="flex px-4 pt-4 pb-2 gap-2 overflow-x-auto border-b">
          <button
            onClick={() => { setActiveMajorTab(''); setActiveYearTab('all'); }}
            className={`px-3 py-1.5 rounded-t-lg text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${activeMajorTab === '' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
          >
            WSZYSTKIE
          </button>
          {majorsData?.data?.map((m: any) => (
            <button
              key={m.id}
              onClick={() => { setActiveMajorTab(m.code); setActiveYearTab('all'); }}
              className={`px-3 py-1.5 rounded-t-lg text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${activeMajorTab === m.code ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
            >
              {m.code}
            </button>
          ))}
        </div>

        <>
          {activeMajorTab !== '' && (
            <div className="flex px-4 py-2 gap-2 overflow-x-auto bg-muted/30 border-b items-center shadow-inner">
              <span className="text-[11px] uppercase font-bold text-muted-foreground mr-2 tracking-wider">Filtruj rok studiów:</span>
              <button
                onClick={() => setActiveYearTab('all')}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${activeYearTab === 'all' ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-background border border-border text-muted-foreground hover:bg-muted hover:text-foreground'}`}
              >
                Wszystkie lata
              </button>
              {Array.from({ length: activeMajorTab.startsWith('S2') ? 2 : 3 }).map((_, i) => {
                const year = i + 1;
                return (
                  <button
                    key={year}
                    onClick={() => setActiveYearTab(year.toString())}
                    className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${activeYearTab === year.toString() ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-background border border-border text-muted-foreground hover:bg-muted hover:text-foreground'}`}
                  >
                    {year} rok
                  </button>
                );
              })}
            </div>
          )}

          <GroupsTable
            groups={(filterInstituteId ? (groupsData?.data ?? []).filter((g: any) => g.instituteId === filterInstituteId) : groupsData?.data) ?? []}
            isLoading={isLoadingGroups}
            activeMajorTab={activeMajorTab}
            activeYearTab={activeYearTab}
            onEdit={openEdit}
            onDelete={(id) => deleteMutation.mutate(id)}
            onDuplicate={handleDuplicate}
          />
        </>
      </div>

      <GroupFormDialog
        isOpen={isOpen}
        editingGroup={editingGroup}
        semestersData={semestersData}
        majorsData={majorsData}
        groupsData={groupsData}
        isPending={createMutation.isPending || updateMutation.isPending}
        onClose={() => { setIsOpen(false); setEditingGroup(null); }}
        onSubmit={handleFormSubmit}
      />
    </div>
  );
}
