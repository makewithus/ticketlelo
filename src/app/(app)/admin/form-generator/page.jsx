"use client";

import { FormGenerator } from "@/components/admin/form-generator";

export default function FormGeneratorPage() {
  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900">Form Generator</h1>
        <p className="text-slate-600 mt-2">
          Create custom registration forms for your events
        </p>
      </div>
      <FormGenerator />
    </div>
  );
}
