import { NextRequest, NextResponse } from 'next/server';
import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium-min';
import * as cheerio from 'cheerio';
import type { Element } from 'domhandler';
import { html as beautifyHtml } from 'js-beautify';
import fs from 'fs';

// Constants for detection
const OAUTH_PROVIDERS = ['google', 'apple', 'facebook', 'microsoft', 'github', 'gitlab', 'okta', 'auth0', 'linkedin', 'twitter', 'bitbucket', 'sso'];
const ACTION_KEYWORDS = ['sign', 'log', 'continue', 'auth', 'connect', 'login', 'account', 'identity'];

/**
 * 1. Scoring Engine
 */
function getElementInfo(el: Element, $: cheerio.CheerioAPI): {
    score: number,
    type: 'TRADITIONAL' | 'OAUTH' | 'ACTION' | 'UNKNOWN',
    brand?: string
} {
    const attribs = el.attribs || {};
    const text = $(el).text().toLowerCase();
    const combined = (Object.values(attribs).join(' ') + ' ' + text).toLowerCase();

    let score = 0;
    let type: 'TRADITIONAL' | 'OAUTH' | 'ACTION' | 'UNKNOWN' = 'UNKNOWN';
    let foundBrand: string | undefined;

    for (const provider of OAUTH_PROVIDERS) {
        if (combined.includes(provider)) {
            foundBrand = provider;
            const isAction = ACTION_KEYWORDS.some(k => combined.includes(k));
            score += isAction ? 25 : 15;
            type = 'OAUTH';
            break;
        }
    }

    if (type === 'UNKNOWN' && el.name === 'input') {
        const inputType = attribs.type?.toLowerCase();
        if (inputType === 'password' || combined.includes('password')) {
            score += 30;
            type = 'TRADITIONAL';
        }
        else if (combined.includes('email') || combined.includes('username') || inputType === 'email') {
            score += 20;
            type = 'TRADITIONAL';
        }
    }

    if (type === 'UNKNOWN' && (el.name === 'button' || attribs.role === 'button' || el.name === 'a')) {
        if (ACTION_KEYWORDS.some(k => text.includes(k)) && text.length < 30) {
            score += 12;
            type = 'ACTION';
        }
    }

    return { score, type, brand: foundBrand };
}

/**
 * 2. DOM Cleaner
 */
function sanitizeHtml($el: cheerio.Cheerio<any>, $: cheerio.CheerioAPI) {
    if (!$el || $el.length === 0) return $el;
    $el.find('script, style, noscript, iframe, link, meta, template, head').remove();
    $el.find('svg').each((_, svg) => {
        const inner = $(svg).html() || '';
        if (inner.length > 2000) $(svg).remove();
    });
    $el.find('*').contents().filter((_, node) => node.type === 'comment').remove();
    $el.find('img').each((_, img) => {
        const src = $(img).attr('src') || '';
        if (src.startsWith('data:')) $(img).attr('src', '#asset-data');
    });
    return $el;
}

/**
 * 3. LCA Logic
 */
function findLCA(elements: cheerio.Cheerio<any>, $: cheerio.CheerioAPI): cheerio.Cheerio<Element> {
    if (elements.length === 0) return $('') as any;
    if (elements.length === 1) return $(elements[0]).parent();
    let commonParents = $(elements[0]).parents().toArray();
    for (let i = 1; i < elements.length; i++) {
        const currentParents = $(elements[i]).parents().toArray();
        commonParents = commonParents.filter(p => currentParents.includes(p));
    }
    return $(commonParents[0]) as any;
}

/**
 * 4. Extract snippet
 */
function extractSnippet(el: cheerio.Cheerio<any>, $: cheerio.CheerioAPI): string {
    const clone = el.clone();
    sanitizeHtml(clone, $);
    return $.html(clone);
}

export async function POST(req: NextRequest) {
    try {
        const { url } = await req.json();
        if (!url) return NextResponse.json({ error: 'URL is required' }, { status: 400 });

        let browser;
        if (process.env.VERCEL) {
            const remotePath = 'https://github.com/Sparticuz/chromium/releases/download/v123.0.1/chromium-v123.0.1-pack.tar';
            browser = await puppeteer.launch({
                args: (chromium as any).args,
                defaultViewport: (chromium as any).defaultViewport,
                executablePath: await (chromium as any).executablePath(remotePath),
                headless: (chromium as any).headless,
            });
        } else {
            const paths = [
                'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
                'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
                process.env.LOCALAPPDATA + '\\Google\\Chrome\\Application\\chrome.exe',
                '/usr/bin/google-chrome',
                '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
            ];
            const executablePath = paths.find(p => fs.existsSync(p)) || '';
            browser = await puppeteer.launch({
                args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled'],
                executablePath,
                headless: true
            });
        }

        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36');
        await page.setViewport({ width: 1920, height: 1080 });

        try {
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
            try { await page.waitForNetworkIdle({ idleTime: 500, timeout: 5000 }); } catch (e) { }
        } catch (error) {
            console.error('Initial navigation error:', error);
        }

        const content = await page.content();
        await browser.close();

        const $ = cheerio.load(content);
        const hits: { el: cheerio.Cheerio<any>, score: number, type: string, brand?: string }[] = [];

        $('input, button, a, [role="button"], [class*="auth"], [class*="login"], [class*="oauth"], [class*="social"], [id*="login"], [id*="auth"]').each((_, el) => {
            const info = getElementInfo(el as Element, $);
            if (info.score >= 12) {
                hits.push({ el: $(el), ...info });
            }
        });

        if (hits.length === 0) {
            return NextResponse.json({ found: false, message: 'No authentication components detected.' });
        }

        // Identify Traditonal and OAuth blocks
        const traditionalHits = hits.filter(h => h.type === 'TRADITIONAL');
        const oauthHits = hits.filter(h => h.type === 'OAUTH');

        // Extract OAuth buttons for metadata
        const oauthButtons = oauthHits
            .filter(h => h.brand)
            .map(h => ({
                brand: h.brand!,
                score: h.score,
                html: extractSnippet(h.el.is('button, a') ? h.el : (h.el.closest('button, a') || h.el), $),
                text: h.el.text().trim()
            }));

        const uniqueOAuthButtons = oauthButtons.reduce((acc, curr) => {
            const existing = acc.find(b => b.brand === curr.brand);
            if (!existing || curr.score > existing.score) {
                return [...acc.filter(b => b.brand !== curr.brand), curr];
            }
            return acc;
        }, [] as typeof oauthButtons);

        // Core logic: Find the best container or concatenate multiple if separate
        let finalHtml = '';

        // Try LCA for all significant hits
        const topHits = hits.sort((a, b) => b.score - a.score).slice(0, 10);
        const collection = $(topHits.map(h => h.el[0]));
        let container = findLCA(collection, $);

        // If LCA is good (not the whole page), use it.
        if (container.length > 0 && !container.is('body, html, main') && container.text().length < 15000) {
            finalHtml = $.html(sanitizeHtml(container.first(), $));
        } else {
            // Otherwise, concatenate Traditional and OAuth blocks manually
            let snippets: string[] = [];

            if (traditionalHits.length > 0) {
                const bestTrad = traditionalHits.sort((a, b) => b.score - a.score)[0];
                const tradBlock = bestTrad.el.closest('form, div[class*="login"], div[class*="auth"], section') || bestTrad.el.parent().parent();
                if (tradBlock.length > 0) snippets.push(`<!-- Traditional Auth -->\n${$.html(sanitizeHtml(tradBlock.first(), $))}`);
            }

            if (oauthHits.length > 0) {
                const oauthLCA = findLCA($(oauthHits.map(h => h.el[0])), $);
                const oauthBlock = (oauthLCA.length > 0 && oauthLCA.text().length < 5000) ? oauthLCA : oauthHits[0].el.parent();
                if (oauthBlock.length > 0) snippets.push(`<!-- OAuth / SSO Components -->\n${$.html(sanitizeHtml(oauthBlock.first(), $))}`);
            }

            finalHtml = snippets.join('\n\n');
        }

        const resultHtml = beautifyHtml(finalHtml, {
            indent_size: 2,
            wrap_line_length: 80,
            preserve_newlines: false
        });

        return NextResponse.json({
            found: true,
            metadata: {
                hasTraditional: traditionalHits.length > 0,
                hasOAuth: oauthHits.length > 0,
                brands: Array.from(new Set(uniqueOAuthButtons.map(b => b.brand))),
                count: uniqueOAuthButtons.length
            },
            html: resultHtml,
            oauthButtons: uniqueOAuthButtons
        });

    } catch (error: any) {
        console.error('Scraping Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}