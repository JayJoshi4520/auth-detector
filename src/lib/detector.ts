/**
 * AI-Powered Authentication Detection Engine
 * Identifies auth components using Gemini vision + pattern fallbacks
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { Page } from 'playwright';
import { logger } from './logger';
import type { AuthComponent, DetectionResult, AIDetectionResponse } from '@/lib/types/auth.types';

// ─────────────────────────────────────────────────────────────────────────────
// Module Configuration
// ─────────────────────────────────────────────────────────────────────────────

const TIMEOUTS = {
    aiApi: 60000,
    extraction: 35000,
    selector: 8000,
    fallbackTotal: 12000,
    fallbackPerAttempt: 3000,
};

const HTML_LIMITS = {
    maxSize: 15000,
    minSnippet: 20,
    maxSnippet: 1500,
};

const AI_MODEL = 'gemini-3-flash-preview';

// Pre-compiled extraction patterns for performance
const extractionPatterns = [
    { id: 'pwd-forms', pattern: /<form[^>]*>[\s\S]{0,2000}?<input[^>]*type=["']password["'][^>]*>[\s\S]{0,2000}?<\/form>/gi },
    { id: 'auth-forms', pattern: /<form[^>]*(?:login|signin|sign-in|signup|sign-up|auth|register)[^>]*>[\s\S]{0,1500}?<\/form>/gi },
    { id: 'nav-auth', pattern: /<(?:nav|header|div)[^>]{0,300}>[\s\S]{0,3000}?(?:sign|login|register|auth|log in|sign up|join|get started)[\s\S]{0,3000}?<\/(?:nav|header|div)>/gi, filterFn: (m: string) => /(?:button|a|input)[^>]*(?:sign|login|register|auth)/i.test(m) || /(?:sign in|log in|login|register|sign up|join now|get started)/i.test(m) },
    { id: 'auth-btns', pattern: /<(?:button|a)[^>]*>[\s\S]{0,500}?<\/(?:button|a)>/gi, filterFn: (m: string) => /sign|login|auth|continue|google|facebook|github|twitter|apple|microsoft|linkedin|amazon|passkey|magic|register|join|get started/i.test(m) },
    { id: 'btn-context', pattern: /<(?:div|li|span|header|nav)[^>]{0,200}>[\s\S]{0,1500}?<(?:button|a)[^>]*>[\s\S]{0,800}?<\/(?:button|a)>[\s\S]{0,1500}?<\/(?:div|li|span|header|nav)>/gi, filterFn: (m: string) => /sign|login|auth|continue|google|facebook|github|twitter|apple|microsoft|linkedin|amazon|passkey|magic|register|join|get started/i.test(m) },
    { id: 'auth-divs', pattern: /<div[^>]*(?:class|id)=["'][^"']*(?:login|signin|sign-in|auth|authentication|oauth|social)[^"']*["'][^>]*>[\s\S]{0,1500}?<\/div>/gi },
    { id: 'webauthn', pattern: /<webauthn-subtle[^>]*>[\s\S]{0,800}?<\/webauthn-subtle>/gi },
];

// ─────────────────────────────────────────────────────────────────────────────
// Main Detection Entry Point
// ─────────────────────────────────────────────────────────────────────────────

export const detectAuthentication = async (
    html: string,
    url: string,
    screenshot: string | undefined,
    page: Page,
    requestId: string
): Promise<DetectionResult> => {
    const t0 = Date.now();
    const apiKey = process.env['GEMINI_API_KEY'];

    logger.info(requestId, 'DETECT_BEGIN', {
        url,
        htmlKB: `${Math.round(html.length / 1024)}KB`,
        hasApiKey: !!apiKey,
        hasScreenshot: !!screenshot,
    });

    // Try AI-powered detection first
    if (apiKey) {
        try {
            const aiResult = await runAIDetection(html, url, screenshot, page, apiKey, requestId);
            logger.success(requestId, 'DETECT_DONE', { method: 'ai', found: aiResult.found, count: aiResult.components.length }, t0);
            return aiResult;
        } catch (err) {
            logger.error(requestId, 'DETECT_AI_ERR', err as Error, { url, fallback: 'patterns' });
        }
    }

    // Fallback to pattern matching
    const patternResult = await runPatternDetection(html, url, page, requestId);
    logger.success(requestId, 'DETECT_DONE', { method: 'pattern', found: patternResult.found, count: patternResult.components.length }, t0);
    return patternResult;
};

// ─────────────────────────────────────────────────────────────────────────────
// AI Detection Pipeline
// ─────────────────────────────────────────────────────────────────────────────

const runAIDetection = async (
    html: string,
    url: string,
    screenshot: string | undefined,
    page: Page,
    apiKey: string,
    reqId: string
): Promise<DetectionResult> => {
    const t0 = Date.now();
    logger.info(reqId, 'AI_DETECT_START', { model: AI_MODEL, hasScreenshot: !!screenshot, timeout: `${TIMEOUTS.aiApi}ms` });

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: AI_MODEL });

    const relevantHtml = extractRelevantSections(html, reqId);
    const prompt = buildPrompt(url, relevantHtml, !!screenshot);
    const parts = screenshot ? [{ inlineData: { mimeType: 'image/jpeg', data: screenshot.replace(/^data:image\/\w+;base64,/, '') } }, { text: prompt }] : [{ text: prompt }];

    logger.info(reqId, 'AI_CALL_START', { promptLen: prompt.length, htmlLen: relevantHtml.length });

    const responseText = await withTimeout(
        model.generateContent(parts).then(r => r.response.text()),
        TIMEOUTS.aiApi,
        'AI API call'
    );

    logger.success(reqId, 'AI_CALL_DONE', { responseLen: responseText.length }, t0);

    const aiData = parseAIOutput(responseText, reqId);

    if (aiData.components.length > 0) {
        logger.info(reqId, 'AI_FOUND', { count: aiData.components.length, types: aiData.components.map(c => c.type).join(',') });
    }

    logger.info(reqId, 'EXTRACT_START', { count: aiData.components.length, timeout: `${TIMEOUTS.extraction}ms` });

    const enrichedComponents = await extractSnippetsFromPage(aiData.components, page, reqId);
    const uniqueComponents = removeDuplicates(enrichedComponents, reqId);

    logger.success(reqId, 'AI_DETECT_DONE', { found: aiData.found, componentCount: uniqueComponents.length }, t0);

    return { success: true, url, found: aiData.found, components: uniqueComponents, detectionMethod: 'ai' };
};

// ─────────────────────────────────────────────────────────────────────────────
// HTML Processing
// ─────────────────────────────────────────────────────────────────────────────

const extractRelevantSections = (html: string, reqId: string): string => {
    logger.info(reqId, 'HTML_EXTRACT_START', { originalKB: `${Math.round(html.length / 1024)}KB` });

    const sections: string[] = [];

    extractionPatterns.forEach(({ id, pattern, filterFn }) => {
        pattern.lastIndex = 0;
        const matches = html.match(pattern);
        if (matches) {
            const filtered = filterFn ? matches.filter(filterFn) : matches;
            sections.push(...filtered);
            logger.info(reqId, 'HTML_MATCH', { pattern: id, found: filtered.length });
        }
    });

    let result = [...new Set(sections)].join('\n\n');

    if (result.length < HTML_LIMITS.minSnippet) {
        logger.warn(reqId, 'HTML_EXTRACT_FALLBACK', 'Using body content');
        const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
        result = bodyMatch?.[1]?.slice(0, HTML_LIMITS.maxSize) || html.slice(0, HTML_LIMITS.maxSize);
    } else {
        result = result.slice(0, HTML_LIMITS.maxSize);
        logger.success(reqId, 'HTML_EXTRACT_OK', { extractedKB: `${Math.round(result.length / 1024)}KB`, sectionCount: sections.length, ratio: `${Math.round((result.length / html.length) * 100)}%` });
    }

    return result;
};

const buildPrompt = (url: string, html: string, hasScreenshot: boolean): string => `You are an expert at detecting authentication components on websites.

URL: ${url}

TASK: Find ALL authentication methods. Return Playwright selectors for each.

TYPES:
1. **traditional** - Login forms with email/password, or "Sign in"/"Log in" buttons/links
2. **oauth** - Social login (Google, Facebook, GitHub, etc.) - must mention provider name
3. **passwordless** - Magic links, OTP, passkeys, WebAuthn

SELECTOR TIPS:
- Use text: \`button:has-text("Continue with Google")\`
- Use attributes: \`[data-provider="google"]\`
- For containers: \`div:has(button:has-text("Google"))\`

${hasScreenshot ? 'VISUAL: Screenshot provided for layout context make sure you use to find all the authentication components.\n' : ''} 
OUTPUT FORMAT (JSON only):
{
  "found": true,
  "components": [
    { "type": "traditional", "details": { "fields": ["email", "password"], "playwrightSelector": "form:has(input[type='password'])" } },
    { "type": "oauth", "details": { "providers": ["google"], "playwrightSelector": "button:has-text('Sign in with Google')" } }
  ]
}

HTML:
${html}

Return ONLY valid JSON:`;

// ─────────────────────────────────────────────────────────────────────────────
// AI Response Parsing
// ─────────────────────────────────────────────────────────────────────────────

const parseAIOutput = (text: string, reqId: string): AIDetectionResponse => {
    logger.info(reqId, 'PARSE_START', { len: text.length });

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON in AI response');

    const cleaned = jsonMatch[0].replace(/,(\s*[}\]])/g, '$1').replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

    try {
        const data = JSON.parse(cleaned);
        logger.success(reqId, 'PARSE_OK', { components: data.components?.length || 0 });
        return { found: data.found || false, components: Array.isArray(data.components) ? data.components : [] };
    } catch (e) {
        logger.error(reqId, 'PARSE_ERR', e as Error, { preview: text.slice(0, 200) });
        throw new Error('JSON parse failed');
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// Playwright Snippet Extraction
// ─────────────────────────────────────────────────────────────────────────────

const extractSnippetsFromPage = async (components: AuthComponent[], page: Page, reqId: string): Promise<AuthComponent[]> => {
    logger.info(reqId, 'SNIPPET_EXTRACT_START', { count: components.length });

    const extractOne = async (comp: AuthComponent): Promise<AuthComponent> => {
        const sel = comp.details.playwrightSelector;
        if (!sel) return { ...comp, snippet: `<!-- ${comp.type} detected, no selector -->` };

        try {
            logger.info(reqId, 'TRY_SELECTOR', { type: comp.type, selector: sel });
            const html = await trySelector(page, sel, reqId);

            if (html) {
                logger.success(reqId, 'SELECTOR_OK', { type: comp.type, len: html.length });
                return { ...comp, snippet: truncate(html) };
            }

            logger.warn(reqId, 'SELECTOR_MISS', 'Trying fallback', { type: comp.type });
            const fallback = await runFallbackExtraction(page, comp, reqId);
            return { ...comp, snippet: fallback };
        } catch (err) {
            logger.error(reqId, 'EXTRACT_ERR', err as Error, { type: comp.type, selector: sel });
            return { ...comp, snippet: `<!-- ${comp.type} detected (error) -->` };
        }
    };

    const results = await Promise.race([
        Promise.all(components.map(extractOne)),
        new Promise<AuthComponent[]>(resolve => setTimeout(() => {
            logger.warn(reqId, 'EXTRACT_TIMEOUT', 'Partial results');
            resolve(components.map(c => ({ ...c, snippet: `<!-- ${c.type} detected (timeout) -->` })));
        }, TIMEOUTS.extraction))
    ]);

    const okCount = results.filter(c => c.snippet && !c.snippet.includes('(error)') && !c.snippet.includes('(timeout)')).length;
    logger.success(reqId, 'SNIPPET_EXTRACT_DONE', { total: results.length, ok: okCount });

    return results;
};

const trySelector = async (page: Page, selector: string, reqId: string): Promise<string | null> => {
    try {
        if (page.isClosed()) {
            logger.warn(reqId, 'PAGE_CLOSED', 'Skipping', { selector });
            return null;
        }

        const loc = page.locator(selector).first();
        await loc.waitFor({ state: 'visible', timeout: TIMEOUTS.selector }).catch(() => { });

        if ((await loc.count()) === 0) return null;
        return await loc.evaluate((el: Element) => el.outerHTML);
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (!msg.includes('closed')) logger.warn(reqId, 'SELECTOR_ERR', msg, { selector });
        return null;
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// Fallback Extraction Strategies
// ─────────────────────────────────────────────────────────────────────────────

const runFallbackExtraction = async (page: Page, comp: AuthComponent, reqId: string): Promise<string> => {
    logger.info(reqId, 'FALLBACK_START', { type: comp.type });

    const handlers: Record<string, () => Promise<string>> = {
        oauth: () => oauthFallback(page, comp, reqId),
        traditional: () => traditionalFallback(page, reqId),
        passwordless: () => passwordlessFallback(page, comp, reqId),
    };

    const handler = handlers[comp.type];
    return handler ? handler() : `<!-- ${comp.type} (fallback failed) -->`;
};

const oauthFallback = async (page: Page, comp: AuthComponent, reqId: string): Promise<string> => {
    const providers = comp.details.providers || [];
    const t0 = Date.now();

    logger.info(reqId, 'OAUTH_FALLBACK', { providers: providers.join(','), maxTime: `${TIMEOUTS.fallbackTotal}ms` });

    for (const provider of providers) {
        if (Date.now() - t0 > TIMEOUTS.fallbackTotal) break;

        const pCap = provider.charAt(0).toUpperCase() + provider.slice(1).toLowerCase();
        const selectors = [
            `button:has-text("${pCap}")`, `a:has-text("${pCap}")`,
            `button:has-text("Sign in with ${pCap}")`, `a:has-text("Sign in with ${pCap}")`,
            `button:has-text("Continue with ${pCap}")`, `[data-provider="${provider.toLowerCase()}"]`,
        ];

        for (const sel of selectors) {
            if (Date.now() - t0 > TIMEOUTS.fallbackTotal) break;
            const html = await tryWithTimeout(trySelector(page, sel, reqId), TIMEOUTS.fallbackPerAttempt);
            if (html) {
                logger.success(reqId, 'OAUTH_FALLBACK_OK', { provider, selector: sel, time: `${Date.now() - t0}ms` });
                return html;
            }
        }
    }

    logger.warn(reqId, 'OAUTH_FALLBACK_FAIL', 'No match', { time: `${Date.now() - t0}ms`, providers: providers.join(',') });
    return `<!-- OAuth: ${providers.join(', ')} (extraction timeout: ${Date.now() - t0}ms) -->`;
};

const traditionalFallback = async (page: Page, reqId: string): Promise<string> => {
    const selectors = [
        'form:has(input[type="password"])', 'a:has-text("Sign in")', 'a:has-text("Log in")', 'a:has-text("Login")',
        'button:has-text("Sign in")', 'button:has-text("Log in")', 'a[href*="login"]', 'a[href*="signin"]',
    ];

    for (const sel of selectors) {
        const html = await trySelector(page, sel, reqId);
        if (html) return truncate(html);
    }
    return '<!-- Traditional login (extraction failed) -->';
};

const passwordlessFallback = async (page: Page, comp: AuthComponent, reqId: string): Promise<string> => {
    const method = comp.details.method || '';
    const selectors = [
        `button:has-text("${method}")`, 'button:has-text("passkey")', 'button:has-text("magic link")',
        'input[inputmode="numeric"]', 'webauthn-subtle',
    ];

    for (const sel of selectors) {
        const html = await trySelector(page, sel, reqId);
        if (html) return truncate(html);
    }
    return `<!-- Passwordless (${method}) (extraction failed) -->`;
};

// ─────────────────────────────────────────────────────────────────────────────
// Pattern-Based Detection (Fallback)
// ─────────────────────────────────────────────────────────────────────────────

const runPatternDetection = async (html: string, url: string, page: Page, reqId: string): Promise<DetectionResult> => {
    logger.info(reqId, 'PATTERN_DETECT_START', { url });

    const components: AuthComponent[] = [];

    // Traditional auth detection
    if (/<form[^>]*>[\s\S]*?<input[^>]*type=["']password["'][\s\S]*?<\/form>/i.test(html) ||
        /(?:sign\s*in|log\s*in|login)/i.test(html)) {
        components.push({ type: 'traditional', details: { fields: ['email', 'password'], playwrightSelector: 'form:has(input[type="password"])' } });
    }

    // OAuth detection
    const oauthProviders = ['google', 'facebook', 'github', 'twitter', 'apple', 'microsoft', 'linkedin'];
    const foundProviders = oauthProviders.filter(p => new RegExp(`(?:sign|log|continue).*${p}|${p}.*(?:sign|log|continue)`, 'i').test(html));
    if (foundProviders.length > 0) {
        components.push({ type: 'oauth', details: { providers: foundProviders, playwrightSelector: `button:has-text("${foundProviders[0]}")` } });
    }

    // Passwordless detection
    if (/passkey|webauthn|magic.*link|otp|one.*time/i.test(html)) {
        const method = /passkey/i.test(html) ? 'passkey' : /magic.*link/i.test(html) ? 'magic-link' : 'otp';
        components.push({ type: 'passwordless', details: { method, playwrightSelector: `button:has-text("${method}")` } });
    }

    const enriched = await extractSnippetsFromPage(components, page, reqId);
    const unique = removeDuplicates(enriched, reqId);

    logger.success(reqId, 'PATTERN_DETECT_DONE', { found: unique.length > 0, count: unique.length });

    return { success: true, url, found: unique.length > 0, components: unique, detectionMethod: 'pattern' };
};

// ─────────────────────────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────────────────────────

const withTimeout = <T>(promise: Promise<T>, ms: number, label: string): Promise<T> =>
    Promise.race([promise, new Promise<never>((_, rej) => setTimeout(() => rej(new Error(`${label} timeout after ${ms}ms`)), ms))]);

const tryWithTimeout = async <T>(promise: Promise<T>, ms: number): Promise<T | null> => {
    try {
        return await withTimeout(promise, ms, 'operation');
    } catch {
        return null;
    }
};

const truncate = (html: string): string => html.length > HTML_LIMITS.maxSnippet ? html.slice(0, HTML_LIMITS.maxSnippet) + '...' : html;

const removeDuplicates = (components: AuthComponent[], reqId: string): AuthComponent[] => {
    const seen = new Set<string>();
    const result = components.filter(c => {
        const key = `${c.type}:${c.snippet?.slice(0, 100) || 'no-snippet'}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });

    if (result.length < components.length) {
        logger.info(reqId, 'DEDUP', { before: components.length, after: result.length });
    }
    return result;
};
