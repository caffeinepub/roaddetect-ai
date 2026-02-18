import { useState } from 'react';
import { FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

export default function ReportDialog() {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="btn-icon-align h-10 w-10 rounded-xl transition-colors duration-200 hover:bg-primary/10 motion-safe:hover:shadow-glow-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          aria-label="Generate Report"
        >
          <FileText className="h-5 w-5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            PDF Report Generator
          </DialogTitle>
          <DialogDescription>
            Generate comprehensive PDF reports
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4 py-4">
          <Button
            disabled
            className="btn-stable w-full"
          >
            Generate Report (Requires Backend Support)
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
