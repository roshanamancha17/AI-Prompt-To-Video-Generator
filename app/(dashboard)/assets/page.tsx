import { Card, CardBody } from '@/components/ui/card';

export default function Page() {
  return (
    <div className="max-w-4xl">
      <h1 className="font-display text-2xl font-semibold text-paper-100">Generated Assets</h1>
      <Card className="mt-6">
        <CardBody className="py-10 text-center text-sm text-ink-500">Images and voiceovers you generate will be listed here, filterable by project and type.</CardBody>
      </Card>
    </div>
  );
}
