import Link from "next/link";

export default function NotFound() {
  return (
    <div className="card flex flex-col items-start gap-4 p-10">
      <h1 className="text-4xl font-bold">There&apos;s no page at this address.</h1>
      <Link href="/" className="btn btn-primary">
        Back to dashboard
      </Link>
    </div>
  );
}
