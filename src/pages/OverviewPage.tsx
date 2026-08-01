import { PageContainer } from '@/features/shared/PageContainer'
import { Card, PanelHeader, Icon } from '@/components/ui'
import { Orb } from '@/components/orb'
import { BriefingHero } from '@/features/briefing/BriefingHero'
import { ActivityCard } from '@/features/briefing/ActivityCard'
import { QuickActions } from '@/features/shared/QuickActions'
import { UpcomingSchedule } from '@/features/schedule/UpcomingSchedule'
import { FocusToday } from '@/features/schedule/FocusToday'
import { CareerSummary } from '@/features/career/CareerSummary'
import { MemorySnapshot } from '@/features/memory/MemorySnapshot'
import { RecentIntelligence } from '@/features/intelligence/RecentIntelligence'
import { SystemHealth } from '@/features/system/SystemHealth'

export default function OverviewPage() {
  return (
    <PageContainer className="p-5 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-[1400px] space-y-5">
        <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
          <BriefingHero />

          <div className="flex flex-col gap-5">
            <Card className="relative overflow-hidden p-4">
              <PanelHeader title="STARC Core" subtitle="AI presence" icon={<Icon name="robot" className="size-4" />} />
              <div className="relative mx-auto mt-2 w-full max-w-[300px]">
                <Orb />
              </div>
            </Card>
            <ActivityCard />
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-3">
          <Card className="p-4 lg:col-span-2">
            <PanelHeader title="Quick Actions" subtitle="One-tap commands" icon={<Icon name="bolt" className="size-4" />} />
            <div className="mt-4">
              <QuickActions />
            </div>
          </Card>
          <FocusToday />
        </div>

        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          <UpcomingSchedule className="md:col-span-2 xl:col-span-1" />
          <CareerSummary />
          <MemorySnapshot />
          <RecentIntelligence />
          <SystemHealth />
        </div>
      </div>
    </PageContainer>
  )
}
