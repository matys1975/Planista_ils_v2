import { Outlet } from '@tanstack/react-router';
import { TooltipProvider } from '../components/ui/tooltip';

export function AppRoot() {
  return (
    <TooltipProvider delayDuration={300}>
      <Outlet />
    </TooltipProvider>
  );
}
