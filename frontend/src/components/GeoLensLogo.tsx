import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import institutionalLogo from '@/assets/logo_web_caroni.webp';

interface GeoLensLogoProps {
  variant?: 'full' | 'icon';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizes = {
  sm: 'h-6 md:h-9',
  md: 'h-9',
  lg: 'h-12',
};

export function GeoLensLogo({
  size = 'sm',
  className,
}: GeoLensLogoProps) {
  const { t } = useTranslation();

  return (
    <span className={cn('inline-flex max-w-full items-center', className)}>
      <img
        src={institutionalLogo}
        alt={t('institutionLogoAlt')}
        width={520}
        height={90}
        className={cn('w-auto max-w-full object-contain', sizes[size])}
      />
    </span>
  );
}
