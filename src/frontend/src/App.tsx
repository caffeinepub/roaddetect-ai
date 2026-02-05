import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import { Toaster } from '@/components/ui/sonner';
import RoadDetectionApp from './pages/RoadDetectionApp';

const queryClient = new QueryClient();

export default function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <QueryClientProvider client={queryClient}>
        <RoadDetectionApp />
        <Toaster />
      </QueryClientProvider>
    </ThemeProvider>
  );
}
