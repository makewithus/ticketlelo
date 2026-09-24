'use client';

import { QRScanner } from '@/components/admin/qr-scanner';

export default function ScannerPage() {
  return (
    <div className="p-8">
      <QRScanner />
    </div>
  );
}
