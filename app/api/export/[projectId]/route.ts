import { NextResponse } from 'next/server';
import { requireProjectOwner, UnauthorizedError, NotFoundError } from '@/lib/auth/requireProjectOwner';
import { buildContentPackage } from '@/lib/services/exportService';

export async function GET(_req: Request, { params }: { params: { projectId: string } }) {
  try {
    const { project } = await requireProjectOwner(params.projectId);
    const zipBuffer = await buildContentPackage(project.id);

    const safeName = project.topic.slice(0, 40).replace(/[^a-z0-9]+/gi, '-').toLowerCase();

    return new NextResponse(zipBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="content-package-${safeName || project.id}.zip"`,
      },
    });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 401 });
    if (err instanceof NotFoundError) return NextResponse.json({ error: err.message }, { status: 404 });
    console.error('Export failed:', err);
    return NextResponse.json({ error: 'Could not build the content package. Please try again.' }, { status: 500 });
  }
}
