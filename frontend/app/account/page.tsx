import type { Metadata } from "next";
import { AccountPanel } from "@/components/auth-form";

export const metadata: Metadata = {
  title: "Your account",
  description: "Your UWA account details.",
  robots: { index: false, follow: true },
};

export default function AccountPage() {
  return (
    <div className="page-wrap section-space">
      <AccountPanel />
    </div>
  );
}
