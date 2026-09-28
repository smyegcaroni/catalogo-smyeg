import { useEffect, useCallback, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Layers, Search, Upload } from 'lucide-react';
import { LoadingState } from '@/components/layout/LoadingState';
import { AppFooter } from '@/components/layout/AppFooter';
import { toast } from 'sonner';
import { useAuthStore } from '@/stores/auth-store';
import { getAuthConfig } from '@/api/auth';
import { queryKeys } from '@/lib/query-keys';
import { GeoLensLogo } from '@/components/GeoLensLogo';
import { LoginForm } from '@/components/auth/LoginForm';
import { OAuthButtons } from '@/components/auth/OAuthButtons';
import { Button } from '@/components/ui/button';
import { useDocumentTitle } from '@/hooks/use-document-title';
import { useBranding } from '@/hooks/use-settings';
import { useEdition } from '@/hooks/use-edition';
import { isSafeHttpUrl } from '@/lib/safe-http-url';
import { writeSessionStorage } from '@/lib/storage';
import catalogBackground from '@/assets/fondo-catalogo.jpg';
import catalogVideo from '@/assets/video-login.mp4';

function getOAuthErrorMessage(error: string, t: (key: string, opts?: Record<string, string>) => string): string {
  if (error.includes('invalid_grant')) {
    return t('oauthErrors.invalidGrant');
  }
  if (error.includes('access_denied')) {
    return t('oauthErrors.accessDenied');
  }
  // SSO reports a rejected email domain through this callback error.
  if (error.includes('domain_not_allowed')) {
    return t('oauthErrors.domainNotAllowed');
  }
  // The identity is valid but cannot create an account while registration is disabled.
  if (error.includes('registration_disabled')) {
    return t('oauthErrors.registrationDisabled');
  }
  return t('oauthErrors.generic', { error });
}

/** Session-scoped key that suppresses the landing-first redirect.
 *  Written by the "Browse Catalog" button; cleared when the tab closes. */
const GUEST_BROWSE_KEY = 'gl-guest-browse';

export function LoginPage() {
  const { t } = useTranslation('auth');
  useDocumentTitle(t('common:pageTitle.login'));
  const { data: branding } = useBranding();
  const privacyUrl = branding?.privacy_url;
  // Login renders outside AppLayout, so it owns the footer visibility rule.
  // Wait for edition resolution to avoid briefly showing disabled enterprise branding.
  const { isEnterprise, isResolved: editionResolved } = useEdition();
  const showFooterBranding = editionResolved && (!isEnterprise || branding?.show_badge !== false);
  const token = useAuthStore((s) => s.token);
  const location = useLocation();
  const navigate = useNavigate();
  const oauthError = (location.state as { oauthError?: string } | null)?.oauthError;
  // Break-glass: in SSO-only mode the password form is hidden by default, but a
  // manage_settings admin can still authenticate with a password server-side.
  // Keep that path reachable from the UI (e.g. during an SSO outage) behind an
  // explicit disclosure so the clean SSO-only default is preserved.
  const [showBreakGlass, setShowBreakGlass] = useState(false);

  useEffect(() => {
    if (oauthError) {
      toast.error(getOAuthErrorMessage(oauthError, t));
      window.history.replaceState({}, '', '/login');
    }
  }, [oauthError, t]);

  const { data: config, isLoading: configLoading, isError: configError } = useQuery({
    queryKey: queryKeys.authConfig.config,
    queryFn: getAuthConfig,
    staleTime: 5 * 60 * 1000,
  });

  // Suppress LandingFirstGuard for this browser session before opening the catalog.
  const handleBrowseCatalog = useCallback(() => {
    // Denied storage must not disable the anonymous navigation action.
    writeSessionStorage(GUEST_BROWSE_KEY, 'true');
    navigate('/');
  }, [navigate]);

  if (token) {
    const from = (location.state as { from?: string } | null)?.from;
    // The root route is the canonical search workspace.
    const target = from && from.startsWith('/') ? from : '/';
    return <Navigate to={target} replace />;
  }

  if (configLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        {/* LoadingState announces progress through role="status" and aria-live. */}
        <LoadingState />
      </div>
    );
  }

  // In SSO-only mode, treat absent password_login_enabled (older
  // servers) and a config fetch error (fail-open) as "password login allowed".
  const passwordLoginEnabled = config?.password_login_enabled !== false;
  const showPasswordForm = passwordLoginEnabled || showBreakGlass;
  const showSignup =
    config?.allow_signup === true ||
    (config?.allow_signup === undefined && config?.registration_enabled === true);
  const instanceHost = typeof window !== 'undefined' ? window.location.host : '';

  const features = [
    { Icon: Search, title: t('loginFeatures.searchTitle'), desc: t('loginFeatures.searchDesc') },
    { Icon: Layers, title: t('loginFeatures.buildTitle'), desc: t('loginFeatures.buildDesc') },
    { Icon: Upload, title: t('loginFeatures.importTitle'), desc: t('loginFeatures.importDesc') },
  ];

  return (
    <div className="flex min-h-screen flex-col">
    <main className="grid flex-1 grid-cols-1 min-[880px]:grid-cols-[1.05fr_0.95fr]">
      {/* ───────── LEFT — brand / map panel (hidden ≤880px) ───────── */}
      <section
        className="relative hidden overflow-hidden border-e border-border bg-cover bg-center px-14 py-12 min-[880px]:flex min-[880px]:flex-col min-[880px]:justify-between"
        style={{ backgroundImage: `url(${catalogBackground})` }}
      >
        <video
          className="pointer-events-none absolute inset-0 size-full object-cover object-center motion-reduce:hidden"
          autoPlay
          loop
          muted
          playsInline
          preload="metadata"
          poster={catalogBackground}
          aria-hidden="true"
        >
          <source src={catalogVideo} type="video/mp4" />
        </video>

        {/* The dark scrim preserves text contrast over the moving background. */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-black/75 via-black/50 to-black/20" />

        <div className="relative z-10 flex h-full flex-col">
          {/* Top — logo lockup + eyebrow */}
          <div>
            {/* Use the guest-browse escape so the logo works when landing-first is enabled. */}
            <button
              type="button"
              onClick={handleBrowseCatalog}
              className="inline-flex text-white transition-colors hover:text-white/80 focus-visible:rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black"
            >
              <GeoLensLogo size="lg" />
            </button>
            <p className="eyebrow mt-2.5 text-white/75">
              {t('geospatialDataCatalog')}
            </p>
          </div>

          {/* Middle — hero (optically centered) */}
          <div className="my-auto max-w-[460px] py-8">
            <h1 className="text-pretty text-4xl font-semibold leading-[1.08] tracking-[-0.025em] text-white">
              {t('loginHero')}
            </h1>
            <p className="mt-4 max-w-[400px] text-base leading-[1.55] text-white/80">
              {t('loginHeroSub')}
            </p>

            <div className="mt-8 flex flex-col gap-3.5">
              {features.map(({ Icon, title, desc }) => (
                <div key={title} className="flex items-start gap-3">
                  <span className="flex size-[30px] shrink-0 items-center justify-center rounded-lg bg-white/15 text-white">
                    <Icon className="size-[15px]" />
                  </span>
                  <span className="text-sm">
                    <span className="block font-semibold text-white">{title}</span>
                    <span className="leading-[1.45] text-white/75">{desc}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom — instance footer */}
          <div className="flex items-center justify-between font-mono text-2xs tracking-[0.04em] text-white/70">
            <span>{instanceHost}</span>
            <span>40.7128°N · 74.0060°W</span>
          </div>
        </div>
      </section>

      {/* ───────── RIGHT — sign-in form panel ───────── */}
      <section className="relative flex flex-col items-center justify-center bg-background px-10 py-12">
        {/* Persistent top-right browse link — the immediate escape hatch. */}
        <Button
          variant="ghost"
          className="absolute end-[14px] top-[14px] h-auto gap-1.5 px-3 py-1.5 text-xs font-medium text-muted-foreground min-[880px]:end-[26px] min-[880px]:top-[22px]"
          onClick={handleBrowseCatalog}
        >
          {t('browseCatalogCta')}
          <ArrowRight className="size-3.5 text-primary rtl-mirror" />
        </Button>

        <div className="w-full max-w-[360px]">
          {/* Mobile needs its own branding and level-one heading because the
              desktop brand panel and its heading are hidden below 880px. */}
          <div className="mb-6 flex flex-col items-center gap-2 text-center min-[880px]:hidden">
            <GeoLensLogo size="md" />
            <h1 className="text-pretty text-lg font-semibold leading-snug tracking-[-0.01em] text-foreground">
              {t('loginHero')}
            </h1>
          </div>
          {/* Form head */}
          <div className="mb-5">
            <h2 className="text-xl font-semibold tracking-[-0.01em] text-foreground">
              {t('signIn')}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">{t('welcomeBack')}</p>
          </div>

          {configError && (
            <p className="mb-4 text-sm text-destructive">{t('authConfig.loadFailed')}</p>
          )}

          {/* In SSO-only mode, hide the password form without a flash when
              password_login_enabled is explicitly false. Config is already
              resolved here (configLoading shows the LoadingState above). Treat an
              absent field (older servers) and a config error as true. */}
          {showPasswordForm ? (
            <>
              <LoginForm />
              {!passwordLoginEnabled && (
                <Button
                  variant="link"
                  className="mt-2 h-auto p-0 text-xs text-muted-foreground"
                  onClick={() => setShowBreakGlass(false)}
                >
                  {t('ssoOnly.hidePasswordSignIn')}
                </Button>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center gap-1 text-center">
              <p className="text-sm text-muted-foreground">{t('ssoOnly.signInWithProvider')}</p>
              {/* Admin break-glass: reveal the password form so a manage_settings
                  admin can sign in if SSO is unavailable (server enforces the gate). */}
              <Button
                variant="link"
                className="h-auto p-0 text-xs text-muted-foreground"
                onClick={() => setShowBreakGlass(true)}
              >
                {t('ssoOnly.adminPasswordSignIn')}
              </Button>
            </div>
          )}

          {/* Adaptive OAuth: 0 → renders nothing; 1 → labeled; 2-3 → icon row.
              The divider only belongs above the buttons when a password form
              sits above it. */}
          <div className="mt-5">
            <OAuthButtons showDivider={showPasswordForm} />
          </div>

          {/* Legal */}
          {isSafeHttpUrl(privacyUrl) && (
            <p className="mt-5 text-center text-mini leading-relaxed text-muted-foreground">
              {t('consentNote')}{' '}
              <a
                href={privacyUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="underline decoration-border underline-offset-2 hover:text-foreground"
              >
                {t('privacyPolicy')}
              </a>
              {t('consentNoteSuffix')}
            </p>
          )}

          {/* Show signup when allow_signup is true;
              fall back to registration_enabled for older servers. */}
          {showSignup && (
            <p className="mt-3 text-center text-sm text-muted-foreground">
              {t('needAccount')}{' '}
              <Link to="/register" className="text-primary underline hover:text-primary/80">
                {t('createOne')}
              </Link>
            </p>
          )}

          {/* Browse block — second, deliberate browse path at the end of the form. */}
          <div className="mt-[18px] border-t border-border pt-[18px] text-center">
            <p className="mb-2.5 text-xs text-muted-foreground">
              {t('browseCatalogHelper')}
            </p>
            {/* Sets gl-guest-browse to suppress the landing-first
                redirect for the rest of the session before navigating to /. */}
            <Button
              variant="outline"
              className="h-10 w-full gap-1.5 font-semibold"
              onClick={handleBrowseCatalog}
            >
              {t('browseCatalogCta')}
              <ArrowRight className="size-3.5 text-primary rtl-mirror" />
            </Button>
          </div>
        </div>
      </section>
    </main>
    <AppFooter showBranding={showFooterBranding} />
    </div>
  );
}
