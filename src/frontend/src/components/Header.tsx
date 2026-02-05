import { Moon, Sun, Activity } from 'lucide-react';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import PDFReportGenerator from './PDFReportGenerator';

export default function Header() {
  const { theme, setTheme } = useTheme();

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-primary via-chart-1 to-chart-2 shadow-lg shadow-primary/30 transition-all duration-300 hover:shadow-glow">
            <Activity className="h-6 w-6 text-primary-foreground" />
          </div>
          <span className="bg-gradient-to-r from-primary to-chart-1 bg-clip-text text-xl font-bold text-transparent">
            RoadDetect AI
          </span>
        </div>

        <div className="flex items-center gap-3">
          <PDFReportGenerator />
          
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="rounded-xl transition-all duration-300 hover:bg-primary/10 hover:shadow-glow-sm"
          >
            <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            <span className="sr-only">Toggle theme</span>
          </Button>
        </div>
      </div>
    </header>
  );
}
