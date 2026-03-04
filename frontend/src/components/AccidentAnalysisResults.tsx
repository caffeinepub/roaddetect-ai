import { AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { AccidentAnalysisResult } from '@/lib/accidentAnalysis';

interface AccidentAnalysisResultsProps {
  result: AccidentAnalysisResult;
  imageUrl: string;
  onConfirm: () => void;
  onCancel: () => void;
  isSubmitting?: boolean;
}

export default function AccidentAnalysisResults({
  result,
  imageUrl,
  onConfirm,
  onCancel,
  isSubmitting = false,
}: AccidentAnalysisResultsProps) {
  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.7) return 'text-emergency';
    if (confidence >= 0.4) return 'text-warning';
    return 'text-muted-foreground';
  };

  const getConfidenceBg = (confidence: number) => {
    if (confidence >= 0.7) return 'bg-emergency/10 border-emergency';
    if (confidence >= 0.4) return 'bg-warning/10 border-warning';
    return 'bg-muted/30 border-border';
  };

  return (
    <div className="space-y-6">
      <div className="rounded-lg border-2 bg-card p-6">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h3 className="text-lg font-semibold">Analysis Results</h3>
            <p className="text-sm text-muted-foreground">
              AI-powered accident scene detection
            </p>
          </div>
          {result.isAccident ? (
            <Badge variant="destructive" className="gap-1">
              <AlertTriangle className="h-3 w-3" />
              Accident Detected
            </Badge>
          ) : (
            <Badge variant="outline" className="gap-1">
              <CheckCircle className="h-3 w-3" />
              Low Confidence
            </Badge>
          )}
        </div>

        <div
          className={`mb-4 rounded-lg border-2 p-4 ${getConfidenceBg(result.confidence)}`}
        >
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium">Confidence Score</span>
            <span className={`text-2xl font-bold ${getConfidenceColor(result.confidence)}`}>
              {(result.confidence * 100).toFixed(0)}%
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className={`h-full transition-all ${
                result.confidence >= 0.7
                  ? 'bg-emergency'
                  : result.confidence >= 0.4
                  ? 'bg-warning'
                  : 'bg-muted-foreground'
              }`}
              style={{ width: `${result.confidence * 100}%` }}
            />
          </div>
        </div>

        <div className="mb-4">
          <h4 className="mb-3 text-sm font-medium">Detected Indicators</h4>
          {result.indicators.length > 0 ? (
            <div className="space-y-2">
              {result.indicators.map((indicator, index) => (
                <div
                  key={index}
                  className="flex items-start gap-3 rounded-lg bg-muted/50 p-3"
                >
                  <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-warning" />
                  <div className="flex-1">
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-sm font-medium">{indicator.type}</span>
                      <span className="text-xs text-muted-foreground">
                        {(indicator.confidence * 100).toFixed(0)}%
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {indicator.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
              <XCircle className="h-4 w-4" />
              No significant indicators detected
            </div>
          )}
        </div>

        <div className="rounded-lg bg-muted/30 p-3">
          <p className="text-sm">{result.summary}</p>
        </div>
      </div>

      <div className="rounded-lg border bg-card p-4">
        <h4 className="mb-3 text-sm font-medium">Analyzed Image</h4>
        <img
          src={imageUrl}
          alt="Analyzed accident scene"
          className="w-full rounded-lg"
        />
      </div>

      <div className="flex gap-3">
        <Button
          onClick={onCancel}
          variant="outline"
          className="flex-1"
          disabled={isSubmitting}
        >
          Cancel
        </Button>
        <Button
          onClick={onConfirm}
          className="flex-1 bg-emergency hover:bg-emergency/90"
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Submitting...' : 'Confirm and Submit Report'}
        </Button>
      </div>
    </div>
  );
}
