import type { ReactNode } from "react";

export function AfendaResponsiveDataView({
  desktop,
  mobile,
}: {
  desktop: ReactNode;
  mobile: ReactNode;
}) {
  return (
    <>
      <div data-slot="afenda-data-desktop" className="hidden min-w-0 overflow-x-auto lg:block">
        {desktop}
      </div>
      <div data-slot="afenda-data-mobile" className="lg:hidden">
        {mobile}
      </div>
    </>
  );
}
