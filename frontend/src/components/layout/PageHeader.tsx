import React from "react";

interface PageHeaderProps {
  title: string | React.ReactNode;
  subtitle?: string;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  rightContent?: React.ReactNode;
  centered?: boolean;
}

export function PageHeader({
  title,
  subtitle,
  description,
  icon,
  rightContent,
  centered = false,
}: PageHeaderProps) {
  return (
    <header className={`mb-8 md:mb-12 flex flex-col gap-4 md:gap-6 sm:flex-row animate-in fade-in slide-in-from-bottom-4 duration-500 ease-out ${rightContent ? "sm:items-end sm:justify-between" : ""} ${centered ? "items-center text-center" : "items-center sm:items-start text-center sm:text-left"}`}>
      <div className={`flex flex-col ${centered ? "items-center" : "items-center sm:items-start"} max-w-3xl`}>
        {subtitle && (
          <div className="mb-3 md:mb-4 inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-blue-50 to-indigo-50 px-3 py-1.5 text-[11px] md:text-xs font-extrabold uppercase tracking-widest text-[var(--color-primary)] ring-1 ring-blue-500/20 shadow-sm">
            {icon && <span className="text-[var(--color-accent)]">{icon}</span>}
            {subtitle}
          </div>
        )}
        <h1 className="font-sans text-3xl font-extrabold tracking-tight text-slate-900 md:text-[40px] md:leading-[1.2]">
          {title}
        </h1>
        {description && (
          <p className="mt-3 md:mt-4 text-[15px] text-slate-500 md:text-[17px] leading-relaxed">
            {description}
          </p>
        )}
      </div>
      {rightContent && (
        <div className="shrink-0 mt-2 sm:mt-0 w-full sm:w-auto">
          {rightContent}
        </div>
      )}
    </header>
  );
}
