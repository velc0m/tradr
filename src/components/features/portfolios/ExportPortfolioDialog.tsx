'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { ExportFormat, ExportInclude } from '@/types';

interface ExportPortfolioDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  portfolioId: string;
  portfolioName: string;
}

export function ExportPortfolioDialog({
  open,
  onOpenChange,
  portfolioId,
  portfolioName,
}: ExportPortfolioDialogProps) {
  const [format, setFormat] = useState<ExportFormat>('xlsx');
  const [includeOptions, setIncludeOptions] = useState<ExportInclude[]>(['all']);
  const [isExporting, setIsExporting] = useState(false);
  const { toast } = useToast();

  const handleIncludeChange = (option: ExportInclude) => {
    setIncludeOptions((prev) => {
      // Handle special cases
      if (option === 'all') {
        return ['all'];
      }

      // Remove 'all' if selecting specific options
      const withoutAll = prev.filter((o) => o !== 'all');

      // Toggle the option
      if (withoutAll.includes(option)) {
        const filtered = withoutAll.filter((o) => o !== option);
        // If nothing left, default to 'all'
        return filtered.length > 0 ? filtered : ['all'];
      } else {
        return [...withoutAll, option];
      }
    });
  };

  const handleExport = async () => {
    setIsExporting(true);

    try {
      // Build query parameters
      const params = new URLSearchParams({
        format,
        include: includeOptions.join(','),
      });

      // Fetch the file
      const response = await fetch(`/api/portfolios/${portfolioId}/export?${params.toString()}`);

      if (!response.ok) {
        throw new Error('Failed to export portfolio');
      }

      // Get the filename from Content-Disposition header
      const contentDisposition = response.headers.get('Content-Disposition');
      const filenameMatch = contentDisposition?.match(/filename="?(.+)"?/);
      const filename = filenameMatch?.[1] || `portfolio-${portfolioName}-export.${format}`;

      // Create blob and download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast({
        title: 'Success',
        description: 'File exported successfully',
      });

      onOpenChange(false);
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to export portfolio',
        variant: 'destructive',
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Export Portfolio</DialogTitle>
          <DialogDescription>
            Choose format and data to export from {portfolioName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Format Selection */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">Export Format</Label>
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="format"
                  value="xlsx"
                  checked={format === 'xlsx'}
                  onChange={(e) => setFormat(e.target.value as ExportFormat)}
                  className="w-4 h-4"
                />
                <span className="text-sm">Excel (.xlsx)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="format"
                  value="csv"
                  checked={format === 'csv'}
                  onChange={(e) => {
                    setFormat(e.target.value as ExportFormat);
                    // Remove portfolio info option when switching to CSV
                    setIncludeOptions((prev) => prev.filter((o) => o !== 'portfolio'));
                  }}
                  className="w-4 h-4"
                />
                <span className="text-sm">CSV (.csv)</span>
              </label>
            </div>
          </div>

          {/* Include Options */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">Data to Export</Label>
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeOptions.includes('all')}
                  onChange={() => handleIncludeChange('all')}
                  className="w-4 h-4"
                />
                <span className="text-sm">All Trades</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeOptions.includes('open')}
                  onChange={() => handleIncludeChange('open')}
                  disabled={includeOptions.includes('all')}
                  className="w-4 h-4 disabled:opacity-50"
                />
                <span className="text-sm">Open Trades Only</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeOptions.includes('closed')}
                  onChange={() => handleIncludeChange('closed')}
                  disabled={includeOptions.includes('all')}
                  className="w-4 h-4 disabled:opacity-50"
                />
                <span className="text-sm">Closed Trades Only</span>
              </label>
              <label
                className={`flex items-center gap-2 ${
                  format === 'csv' ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                }`}
              >
                <input
                  type="checkbox"
                  checked={includeOptions.includes('portfolio')}
                  onChange={() => handleIncludeChange('portfolio')}
                  disabled={format === 'csv'}
                  className="w-4 h-4 disabled:opacity-50"
                />
                <span className="text-sm">
                  Portfolio Info
                  {format === 'csv' && (
                    <span className="text-xs text-muted-foreground ml-2">(Excel only)</span>
                  )}
                </span>
              </label>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isExporting}>
            Cancel
          </Button>
          <Button onClick={handleExport} disabled={isExporting}>
            {isExporting ? 'Exporting...' : 'Export'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
