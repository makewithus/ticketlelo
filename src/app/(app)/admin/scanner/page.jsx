'use client';

import { QRScanner } from '@/components/admin/qr-scanner';

export default function ScannerPage() {
  return (
    <div className="py-4 sm:py-6 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto w-full">
      <QRScanner />
    </div>
  );
}
