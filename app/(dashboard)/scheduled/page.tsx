import { Card, CardBody } from '@/components/ui/card';

export default function Page() {
  return (
    <div className="max-w-4xl">
      <h1 className="font-display text-2xl font-semibold text-paper-100">Scheduled Content</h1>
      <Card className="mt-6">
        <CardBody className="py-10 text-center text-sm text-ink-500">A calendar view arrives with Phase 7 publishing — for now, scheduled projects will be listed here.</CardBody>
      </Card>
    </div>
  );
}
