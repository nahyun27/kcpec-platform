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
    <header className={`mb-6 pb-2 md:mb-8 md:pb-4 flex flex-col gap-3 md:gap-4 sm:flex-row ${rightContent ? "sm:items-end sm:justify-between" : ""} ${centered ? "text-center sm:text-center" : "text-center sm:text-left"}`}>
      <div className={centered ? "mx-auto" : ""}>
        {subtitle && (
          <div className="mb-3 md:mb-4 inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-[10px] md:text-xs font-bold uppercase tracking-widest text-[var(--color-accent)] ring-1 ring-blue-500/20">
            {icon}
            {subtitle}
          </div>
        )}
        <h1 className="font-sans text-2xl font-extrabold tracking-tight text-slate-900 md:text-4xl">
          {title}
        </h1>
        {description && (
          <p className="mt-2 md:mt-3 text-sm text-slate-500 md:text-lg">
            {description}
          </p>
        )}
      </div>
      {rightContent && (
        <div className="shrink-0">
          {rightContent}
        </div>
      )}
    </header>
  );
}
