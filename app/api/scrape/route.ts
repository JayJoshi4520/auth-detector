import { NextRequest, NextResponse } from 'next/server';
import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';
import * as cheerio from 'cheerio';
import type { Element } from 'domhandler';
import { html } from 'js-beautify';

// Keywords to search for in element attributes
const AUTH_KEYWORDS = ['password', 'pass', 'pwd', 'email', 'mail', 'user', 'username', 'login', 'signin', 'sign-in', 'auth', 'credential', 'account'];

// Attributes to check for keywords
const ATTRS_TO_CHECK = ['type', 'name', 'id', 'class', 'placeholder', 'aria-label', 'data-testid', 'autocomplete'];

function hasAuthKeyword(attribs: Record<string, string>): boolean {
    for (const attr of ATTRS_TO_CHECK) {
        const value = (attribs[attr] || '').toLowerCase();
        if (AUTH_KEYWORDS.some(kw => value.includes(kw))) {
            return true;
        }
    }
    return false;
}

function scoreElement(attribs: Record<string, string>): number {
    let score = 0;
    for (const attr of ATTRS_TO_CHECK) {
        const value = (attribs[attr] || '').toLowerCase();
        if (value.includes('password') || value.includes('pwd')) score += 10;
        if (value.includes('email') || value.includes('mail')) score += 5;
        if (value.includes('user') || value.includes('username')) score += 5;
        if (value.includes('login') || value.includes('signin')) score += 3;
    }
    return score;
}

export async function POST(req: NextRequest) {
    try {
        const { url } = await req.json();

        if (!url) {
            return NextResponse.json({ error: 'URL is required' }, { status: 400 });
        }

        let browser;

        if (process.env.VERCEL || process.env.NODE_ENV === 'production') {
            // Vercel / Production environment
            browser = await puppeteer.launch({
                args: chromium.args,
                defaultViewport: (chromium as any).defaultViewport,
                executablePath: await chromium.executablePath(),
                headless: (chromium as any).headless,
            });
        } else {
            // Local development (Windows/Mac/Linux)
            // Note: You must have Chrome installed locally
            const localPath = process.platform === 'win32'
                ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
                : process.platform === 'darwin'
                    ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
                    : '/usr/bin/google-chrome';

            browser = await puppeteer.launch({
                args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled'],
                executablePath: localPath,
                headless: true,
            });
        }

        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        await page.setViewport({ width: 1920, height: 1080 });

        try {
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

            //Look for common login indicators across multiple attributes
            try {
                await page.waitForSelector(
                    'input[type="password"], input[name*="pass"], input[id*="pass"], input[placeholder*="pass"], ' +
                    'input[name*="email"], input[id*="email"], input[placeholder*="email"], ' +
                    'input[name*="user"], input[id*="user"], input[placeholder*="user"], ' +
                    'form[class*="login"], form[id*="login"], form[class*="auth"]',
                    { timeout: 8000 }
                );
            } catch (e) {
                try { await page.waitForNetworkIdle({ idleTime: 500, timeout: 3000 }); } catch (err) { }
            }

        } catch (error) {
            console.error('Navigation error:', error);
        }

        const content = await page.content();
        await browser.close();

        const $ = cheerio.load(content);
        let authComponentHtml = null;
        let bestScore = 0;


        // Step 1: Find ALL inputs and score them
        const allInputs = $('input');
        let bestInput: cheerio.Cheerio<Element> | null = null;

        allInputs.each((i, el) => {
            const attribs = el.attribs || {};
            const score = scoreElement(attribs);
            if (score > bestScore) {
                bestScore = score;
                bestInput = $(el);
            }
        });

        // Step 2: If we found a high-scoring input, get its container
        if (bestInput && bestScore >= 5) {
            // Try to find the form first
            let container = (bestInput as cheerio.Cheerio<Element>).closest('form');

            // If no form, look for semantic containers
            if (container.length === 0) {
                container = (bestInput as cheerio.Cheerio<Element>).closest(
                    'div[class*="login"], div[class*="auth"], div[class*="form"], ' +
                    'div[id*="login"], div[id*="auth"], div[id*="form"], ' +
                    'section, main, [role="dialog"], [role="main"]'
                );
            }

            // Fallback to parent chain
            if (container.length === 0) {
                container = (bestInput as cheerio.Cheerio<Element>).parent().parent().parent();
            }

            if (container.length > 0 && container.text().length < 10000) {
                authComponentHtml = $.html(container.first());
            }
        }

        // Step 3: If no high-score input, look for forms with auth-related attributes
        if (!authComponentHtml) {
            $('form').each((i, el) => {
                const attribs = el.attribs || {};
                const formHtml = $.html(el).toLowerCase();

                // Check form attributes
                let formScore = scoreElement(attribs);

                // Check form content for keywords
                if (formHtml.includes('password')) formScore += 10;
                if (formHtml.includes('email')) formScore += 5;
                if (formHtml.includes('username') || formHtml.includes('user')) formScore += 5;
                if (formHtml.includes('login') || formHtml.includes('sign in')) formScore += 3;

                // Must have inputs
                if ($(el).find('input').length > 0 && formScore >= 5) {
                    authComponentHtml = $.html(el);
                    return false;
                }
            });
        }

        // Step 4: Fallback - any input with auth keywords in ANY attribute
        if (!authComponentHtml) {
            allInputs.each((i, el) => {
                const attribs = el.attribs || {};
                if (hasAuthKeyword(attribs)) {
                    const container = $(el).closest('form') || $(el).parent().parent();
                    if (container.length > 0) {
                        authComponentHtml = $.html(container.first());
                        return false;
                    }
                }
            });
        }

        // Step 5: Last resort - look for any form with at least 2 inputs
        if (!authComponentHtml) {
            $('form').each((i, el) => {
                const inputs = $(el).find('input');
                if (inputs.length >= 2) {
                    authComponentHtml = $.html(el);
                    return false;
                }
            });
        }

        if (!authComponentHtml) {
            return NextResponse.json({
                found: false,
                message: 'No authentication component found. The site may use a non-standard login method or heavy JavaScript rendering.'
            });
        }

        // Format the HTML
        const formattedHtml = html(authComponentHtml, {
            indent_size: 2,
            wrap_line_length: 80,
            preserve_newlines: false
        });

        return NextResponse.json({
            found: true,
            html: formattedHtml
        });

    } catch (error: any) {
        console.error('Scraping error:', error);
        return NextResponse.json({ error: 'Failed to scrape: ' + error.message }, { status: 500 });
    }
}
