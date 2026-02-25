import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] text-center px-4">
      <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-6xl">
        Decentralized Medical Records
      </h1>
      <p className="mt-6 text-lg leading-8 text-slate-600 max-w-2xl">
        A secure platform for patients and doctors to manage medical data 
        with sovereign identity on the Stellar network.
      </p>
      <div className="mt-10 flex items-center justify-center gap-x-6">
        <Link
          href="/login"
          className="rounded-md bg-blue-600 px-3.5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
        >
          Connect Wallet
        </Link>
        <Link href="/docs" className="text-sm font-semibold leading-6 text-slate-900">
          Learn more <span aria-hidden="true">→</span>
        </Link>
      </div>
    </div>
  );
}