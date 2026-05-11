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
    <header className={`mb-8 flex flex-col gap-4 pb-4 sm:flex-row ${rightContent ? "sm:items-end sm:justify-between" : ""} ${centered ? "text-center sm:text-center" : "text-center sm:text-left"}`}>
      <div className={centered ? "mx-auto" : ""}>
        {subtitle && (
          <div className="mb-4 inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-bold uppercase tracking-widest text-[var(--color-accent)] ring-1 ring-blue-500/20">
            {icon}
            {subtitle}
          </div>
        )}
        <h1 className="font-sans text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
          {title}
        </h1>
        {description && (
          <p className="mt-3 text-base text-slate-500 sm:text-lg">
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
