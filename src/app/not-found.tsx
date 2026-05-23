import Link from "next/link";
import { Button } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <div className="min-h-dvh flex flex-col items-center justify-center bg-navy-950 px-6 text-center">
      <p className="text-gold-600 text-xs font-medium tracking-widest uppercase mb-4">
        404
      </p>
      <h1 className="font-display text-3xl font-semibold text-cream mb-2">
        Location not found
      </h1>
      <p className="text-stone-400 text-sm mb-10">
        This location does not exist in the mission archive.
      </p>
      <Link href="/">
        <Button variant="ghost">Return to base</Button>
      </Link>
    </div>
  );
}
