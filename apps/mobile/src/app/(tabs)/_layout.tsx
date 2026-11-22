import AppTabs from '@/components/app-tabs';
import { GulluFab } from '@/components/gullu-fab';

export default function TabLayout() {
  return (
    <>
      <AppTabs />
      {/* Gullu floats over every main tab, bottom-right. */}
      <GulluFab />
    </>
  );
}
