import { cn } from '@/lib/utils';

interface GeoLensLogoProps {
  variant?: 'full' | 'icon';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizes = {
  sm: { text: 'text-base', gap: 'gap-1.4' },
  md: { text: 'text-lg', gap: 'gap-1.4' },
  lg: { text: 'text-2xl', gap: 'gap-2' },
};

export function GeoLensLogo({
  variant = 'full',
  size = 'sm',
  className,
}: GeoLensLogoProps) {
  const s = sizes[size];

  return (
    <span className={cn('inline-flex items-center', s.gap, className)}>
      <img
        src="https://gisdata.es/FAO_logo_01.svg"
        alt="FAO Logo"
        width={40}
        height={40}
        className="shrink-0 mr-[15px]"
      />
      {variant === 'full' && (
        <span className={cn(s.text, 'font-bold tracking-tight')}>
          <span style={{ color: '#009edb' }}>Catálogo SMYEG</span>
          <span className="font-light text-muted-foreground"> | Cuenca del Río Caroní</span>
        </span>
      )}
    </span>
  );
}
