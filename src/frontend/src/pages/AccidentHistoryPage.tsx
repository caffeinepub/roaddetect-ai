import type { AccidentRecord } from "@/backend";
import AccidentDetailView from "@/components/AccidentDetailView";
import AccidentHistoryList from "@/components/AccidentHistoryList";
import AccidentReportDialog from "@/components/AccidentReportDialog";
import { useState } from "react";

export default function AccidentHistoryPage() {
  const [selectedAccident, setSelectedAccident] =
    useState<AccidentRecord | null>(null);

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
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold bg-gradient-to-r from-primary to-chart-2 bg-clip-text text-transparent">
            Accident Reports
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            View all reported accidents with AI analysis and manual reports
          </p>
        </div>
        <AccidentReportDialog
          triggerClassName="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-4 py-2 rounded-lg flex items-center gap-2 text-sm transition-all shadow-glow-sm hover:shadow-glow border border-primary/60"
          triggerLabel="Report Accident"
          data-ocid="accident_reports.report_button"
        />
      </div>
      <AccidentHistoryList onSelectAccident={setSelectedAccident} />
    </div>
  );
}
