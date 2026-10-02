import Link from "next/link";
import { SealMark } from "@/components/logo";

export default function NotFound() {
  return (
    <div className="grid min-h-screen place-items-center px-6 text-center">
      <div>
        <SealMark className="mx-auto h-14 w-14" />
        <h1 className="mt-6 font-serif text-5xl">Not found</h1>
        <p className="mt-2 text-sm text-muted">This page doesn&apos;t exist, or the seal was never pressed.</p>
        <Link href="/" className="mt-6 inline-block text-sm font-medium text-accent hover:underline">
          Back to Siegel
        </Link>
      </div>
    </div>
  );
}
