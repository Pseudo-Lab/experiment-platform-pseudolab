interface Props {
  lang: 'ko' | 'en';
  compact?: boolean;
}

export function IterglowLogo({ compact = false }: Props) {
  const alt = 'Iterglow';

  if (compact) {
    return <img src="/brand/iterglow-symbol.svg" alt={alt} width={32} height={14} className="h-auto w-8 shrink-0" />;
  }

  return (
    <span className="block w-40 max-w-full shrink-0">
      <img src="/brand/iterglow-logo.svg" alt={alt} width={160} height={27} className="block h-auto w-full dark:hidden" />
      <img src="/brand/iterglow-logo-dark.svg" alt={alt} width={160} height={27} className="hidden h-auto w-full dark:block" />
    </span>
  );
}
