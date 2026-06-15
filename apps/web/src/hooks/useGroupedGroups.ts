// apps/web/src/hooks/useGroupedGroups.ts
import { useMemo } from 'react';
import type { Group } from '../types/models';

interface GroupedGroups {
  [yearLabel: string]: {
    [majorDegreeLabel: string]: Group[];
  };
}

/**
 * Grupuje liste grup studenckich po roczniku (np. "2 rok") i kierunku+stopniu.
 */
export function useGroupedGroups(groupsData: { data?: Group[] } | undefined): GroupedGroups {
  return useMemo(() => {
    if (!groupsData?.data) return {};
    
    return groupsData.data.reduce((acc: GroupedGroups, g: Group) => {
      const yearLabel = `${g.year} rok`;
      if (!acc[yearLabel]) acc[yearLabel] = {};
      
      const majorDegreeLabel = `${g.major} (${g.degree})`;
      if (!acc[yearLabel][majorDegreeLabel]) {
        acc[yearLabel][majorDegreeLabel] = [];
      }
      acc[yearLabel][majorDegreeLabel].push(g);
      return acc;
    }, {});
  }, [groupsData]);
}
