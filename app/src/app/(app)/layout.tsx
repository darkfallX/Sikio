/* Shared frame for the working app screens (Studio, Ear, Approve, Receipts, legal). The landing page at / is full-bleed and sits outside this group. */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-full max-w-[1280px] mx-auto px-4 sm:px-7 pt-6 pb-16 sm:pt-10 sm:pb-24">
      {children}
    </div>
  );
}
