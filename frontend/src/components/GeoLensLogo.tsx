import { cn } from '@/lib/utils';
import faoLogo from '@/assets/fao-logo-white-3lines-es.svg';
import caroniLogo from '@/assets/logo-cuenca-caroni-white.png';

interface GeoLensLogoProps {
  variant?: 'full' | 'icon';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizes = {
  sm: { fao: 'h-5', caroni: 'h-5', gap: 'gap-2' },
  md: { fao: 'h-7', caroni: 'h-7', gap: 'gap-3' },
  lg: { fao: 'h-10', caroni: 'h-10', gap: 'gap-4' },
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
        src={faoLogo}
        alt="Organización de las Naciones Unidas para la Alimentación y la Agricultura"
        className={cn('w-auto shrink-0 object-contain', s.fao)}
      />
      {variant === 'full' && (
        <img
          src={caroniLogo}
          alt="Cuenca del Río Caroní"
          className={cn('w-auto shrink-0 object-contain', s.caroni)}
        />
      )}
    </span>
  );
}
