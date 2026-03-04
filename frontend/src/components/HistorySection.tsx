import { Card, CardContent } from '@/components/ui/card';
import { Image as ImageIcon } from 'lucide-react';

export default function HistorySection() {
  return (
    <Card className="card-enhanced">
      <CardContent className="flex min-h-[400px] flex-col items-center justify-center py-12">
        <ImageIcon className="h-12 w-12 text-muted-foreground" />
        <h3 className="mt-4 text-card-title">Detection History</h3>
        <p className="mt-2 text-center text-description">
          History feature requires additional backend methods
        </p>
      </CardContent>
    </Card>
  );
}
