import { cn } from "@/lib/utils";

type BrandMarkProps = {
  className?: string;
  iconClassName?: string;
};

type BrandLogoProps = BrandMarkProps & {
  wordmarkClassName?: string;
  subtitle?: string;
  subtitleClassName?: string;
};

export function BrandMark({ className, iconClassName }: BrandMarkProps) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 via-violet-600 to-sky-500 text-white shadow-sm",
        className
      )}
      aria-hidden="true"
    >
      <svg
        className={cn("size-2/3", iconClassName)}
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M10.4 7.4H7.4V12"
          stroke="currentColor"
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.92"
        />
        <path
          d="M21.6 24.6H24.6V20"
          stroke="currentColor"
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.92"
        />
        <path
          d="M22.3 8.4C19.7 6.8 13 6.7 11.2 10.7C9.2 15.2 21.8 14.2 19.9 19.6C18.7 23 12.6 22.8 9.6 20.7"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M23.5 10.2L24.2 8.5L25 10.2L26.7 11L25 11.8L24.2 13.5L23.5 11.8L21.8 11L23.5 10.2Z"
          fill="currentColor"
        />
        <circle cx="9.1" cy="20.4" r="1.6" fill="#67E8F9" />
      </svg>
    </span>
  );
}

export function BrandLogo({ className, iconClassName, wordmarkClassName, subtitle, subtitleClassName }: BrandLogoProps) {
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-2.5", className)}>
      <BrandMark className="size-8" iconClassName={iconClassName} />
      <span className="min-w-0">
        <span className={cn("block truncate text-sm font-semibold tracking-tight", wordmarkClassName)}>
          ScopeFlow AI
        </span>
        {subtitle ? (
          <span className={cn("block truncate text-xs text-muted-foreground", subtitleClassName)}>{subtitle}</span>
        ) : null}
      </span>
    </span>
  );
}
