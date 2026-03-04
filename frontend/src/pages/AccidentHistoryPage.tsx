import { useState } from 'react';
import AccidentHistoryList from '@/components/AccidentHistoryList';
import AccidentDetailView from '@/components/AccidentDetailView';
import type { AccidentRecord } from '@/backend';

export default function AccidentHistoryPage() {
  const [selectedAccident, setSelectedAccident] = useState<AccidentRecord | null>(null);

  if (selectedAccident) {
    return (
      <AccidentDetailView
        accident={selectedAccident}
        onBack={() => setSelectedAccident(null)}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Accident Reports</h2>
        <p className="text-sm text-muted-foreground">
          View all reported accidents with AI analysis and manual reports
        </p>
      </div>
      <AccidentHistoryList onSelectAccident={setSelectedAccident} />
    </div>
  );
}
