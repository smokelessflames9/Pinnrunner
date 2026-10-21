/**
 * Lightweight, privacy-safe promotional traffic & click-tracking service for PINN Arcade.
 *
 * - Captures non-sensitive campaign attribution parameters (UTM tags, source/ref) from the URL.
 * - Integrates safely with any configured analytics provider (gtag, dataLayer, plausible, umami)
 *   if present on `window`, and fails silently when no provider is configured.
 * - Never collects or transmits wallet credentials, authentication tokens, or personal data.
 */

export type PinnAnalyticsEventName =
  | 'pinn_homepage_play_clicked'
  | 'pinn_token_hub_viewed'
  | 'pinn_coinbuzzer_clicked'
  | 'pinn_coinboom_clicked'
  | 'pinn_dexscreener_clicked'
  | 'pinn_fomo_clicked'
  | 'pinn_telegram_clicked'
  | 'pinn_contract_copied';

export interface CampaignAttribution {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  source?: string;
  ref?: string;
}

export interface AnalyticsEventPayload {
  platform?: string;
  section?: string;
  destination?: string;
  [key: string]: string | number | boolean | undefined;
}

declare global {
  interface Window {
    gtag?: (command: string, eventName: string, params?: Record<string, unknown>) => void;
    dataLayer?: Array<Record<string, unknown>>;
    plausible?: (eventName: string, options?: { props?: Record<string, unknown> }) => void;
    umami?: {
      track?: (eventName: string, data?: Record<string, unknown>) => void;
    };
  }
}

const ATTRIBUTION_STORAGE_KEY = 'pinn_campaign_attribution_v1';
const ALLOWED_ATTRIBUTION_KEYS: Array<keyof CampaignAttribution> = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_content',
  'utm_term',
  'source',
  'ref',
];

function sanitizeParamValue(val: string | null): string | undefined {
  if (!val) return undefined;
  const trimmed = val.trim().slice(0, 64).replace(/[^\w.\-/]/g, '');
  return trimmed.length > 0 ? trimmed : undefined;
}

/**
 * Extracts non-sensitive UTM and campaign parameters from the current URL
 * and caches them in sessionStorage for attribution consistency across the session.
 */
export function getCampaignAttribution(): CampaignAttribution {
  if (typeof window === 'undefined') return {};

  const currentAttribution: CampaignAttribution = {};

  try {
    const cachedRaw = sessionStorage.getItem(ATTRIBUTION_STORAGE_KEY);
    if (cachedRaw) {
      const parsed = JSON.parse(cachedRaw) as CampaignAttribution;
      for (const key of ALLOWED_ATTRIBUTION_KEYS) {
        if (typeof parsed[key] === 'string' && parsed[key]) {
          currentAttribution[key] = parsed[key];
        }
      }
    }
  } catch {
    // Ignore storage access errors
  }

  try {
    const searchParams = new URLSearchParams(window.location.search);
    let updated = false;
    for (const key of ALLOWED_ATTRIBUTION_KEYS) {
      const cleanVal = sanitizeParamValue(searchParams.get(key));
      if (cleanVal) {
        currentAttribution[key] = cleanVal;
        updated = true;
      }
    }

    if (updated) {
      try {
        sessionStorage.setItem(ATTRIBUTION_STORAGE_KEY, JSON.stringify(currentAttribution));
      } catch {
        // Ignore storage write errors
      }
    }
  } catch {
    // Ignore URL parsing errors
  }

  return currentAttribution;
}

/**
 * Dispatches a lightweight, privacy-safe analytics event if an analytics provider is present.
 * Safe no-op if no external analytics script is configured.
 */
export function trackPinnEvent(
  eventName: PinnAnalyticsEventName,
  payload: AnalyticsEventPayload = {}
): void {
  if (typeof window === 'undefined') return;

  try {
    const attribution = getCampaignAttribution();
    const safeProps: Record<string, string | number | boolean> = {};

    for (const [k, v] of Object.entries(attribution)) {
      if (v !== undefined) {
        safeProps[k] = v;
      }
    }

    for (const [k, v] of Object.entries(payload)) {
      if (v !== undefined) {
        safeProps[k] = v;
      }
    }

    // 1. Google Analytics (gtag)
    if (typeof window.gtag === 'function') {
      window.gtag('event', eventName, safeProps);
    }
    // 2. Google Tag Manager (dataLayer)
    else if (Array.isArray(window.dataLayer)) {
      window.dataLayer.push({
        event: eventName,
        ...safeProps,
      });
    }

    // 3. Plausible Analytics
    if (typeof window.plausible === 'function') {
      window.plausible(eventName, { props: safeProps });
    }

    // 4. Umami Analytics
    if (window.umami && typeof window.umami.track === 'function') {
      window.umami.track(eventName, safeProps);
    }

    // 5. Custom DOM event for internal listeners / debugging hooks
    window.dispatchEvent(
      new CustomEvent('pinn:analytics', {
        detail: {
          event: eventName,
          properties: safeProps,
          timestamp: Date.now(),
        },
      })
    );
  } catch {
    // Never allow analytics tracking to interrupt user navigation or gameplay
  }
}
