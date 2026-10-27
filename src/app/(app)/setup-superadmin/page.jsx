"use client";

export default function SetupSuperAdminPage() {
  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="mb-4 text-2xl font-bold">Superadmin provisioning</h1>
      <p>
        Superadmin access cannot be created from the browser. An existing platform
        operator must provision the account through the trusted Firebase Admin
        environment and verify the assigned role before access is granted.
      </p>
    </main>
  );
}
