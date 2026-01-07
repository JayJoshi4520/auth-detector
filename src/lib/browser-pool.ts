/**
 * Browser Connection Pool
 * 
 * Manages a single reusable Playwright browser instance with multiple contexts
 * to improve performance and resource efficiency.
 */

import { Browser, BrowserContext, chromium as playwrightChromium } from 'playwright';
import chromium from '@sparticuz/chromium';
import playwrightCore from 'playwright-core';
import { logger } from './logger';

export class BrowserPool {
    private browser: Browser | null = null;
    private isInitializing = false;
    private initPromise: Promise<Browser> | null = null;
    private lastUsed: number = Date.now();
    private readonly IDLE_TIMEOUT = 5 * 60 * 1000;
    private idleCheckInterval: NodeJS.Timeout | null = null;

    /**
     * Get or create browser instance
     */
    private async getBrowser(requestId: string): Promise<Browser> {
        if (this.browser && this.browser.isConnected()) {
            this.lastUsed = Date.now();
            return this.browser;
        }

        if (this.isInitializing && this.initPromise) {
            logger.info(requestId, 'BROWSER_POOL_WAITING', {
                message: 'Waiting for browser initialization to complete',
            });
            return this.initPromise;
        }

        this.isInitializing = true;
        const startTime = Date.now();

        logger.info(requestId, 'BROWSER_POOL_INIT_START', {
            message: 'Launching new browser instance',
        });

        const launchBrowser = async () => {
            const isServerless = process.env.AWS_LAMBDA_FUNCTION_VERSION || process.env.VERCEL;

            if (isServerless) {
                logger.info(requestId, 'BROWSER_LAUNCH_SERVERLESS', {
                    message: 'Launching chromium-min for serverless environment',
                });
                const executablePath = await chromium.executablePath();
                return await playwrightCore.chromium.launch({
                    args: chromium.args,
                    executablePath,
                    headless: true,
                }) as unknown as Browser;
            } else {
                logger.info(requestId, 'BROWSER_LAUNCH_LOCAL', {
                    message: 'Launching standard playwright chromium for local environment',
                });
                return await playwrightChromium.launch({
                    headless: true,
                    args: ['--no-sandbox', '--disable-setuid-sandbox'],
                });
            }
        };

        this.initPromise = launchBrowser()
            .then((browser) => {
                this.browser = browser;
                this.isInitializing = false;
                this.lastUsed = Date.now();

                logger.success(requestId, 'BROWSER_POOL_INIT_SUCCESS', {
                    message: 'Browser instance launched',
                }, startTime);

                this.startIdleMonitoring();

                return browser;
            })
            .catch((error) => {
                this.isInitializing = false;
                this.initPromise = null;

                logger.error(requestId, 'BROWSER_POOL_INIT_ERROR', error, {
                    message: 'Failed to launch browser',
                });

                throw error;
            });

        return this.initPromise;
    }

    /**
     * Create new browser context for isolated scraping
     */
    async createContext(requestId: string): Promise<BrowserContext> {
        const browser = await this.getBrowser(requestId);

        logger.info(requestId, 'BROWSER_CONTEXT_CREATE', {
            message: 'Creating new browser context',
        });

        const context = await browser.newContext({
            userAgent:
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            viewport: {
                width: 1920,
                height: 1080,
            },
            timezoneId: 'UTC',
            javaScriptEnabled: true,
        });

        await context.route('**/*', (route) => {
            const resourceType = route.request().resourceType();

            if (['image', 'font', 'media'].includes(resourceType)) {
                route.abort();
            } else {
                route.continue();
            }
        });

        return context;
    }

    /**
     * Close browser context and cleanup resources
     */
    async closeContext(context: BrowserContext, requestId: string): Promise<void> {
        try {
            await context.close();
            logger.info(requestId, 'BROWSER_CONTEXT_CLOSED', {
                message: 'Browser context closed successfully',
            });
        } catch (error) {
            logger.error(requestId, 'BROWSER_CONTEXT_CLOSE_ERROR', error as Error, {
                message: 'Failed to close browser context',
            });
        }
    }

    /**
     * Start monitoring for idle timeout
     */
    private startIdleMonitoring(): void {
        if (this.idleCheckInterval) {
            clearInterval(this.idleCheckInterval);
        }

        this.idleCheckInterval = setInterval(() => {
            const idleTime = Date.now() - this.lastUsed;

            if (idleTime > this.IDLE_TIMEOUT && this.browser) {
                logger.info('SYSTEM', 'BROWSER_POOL_IDLE_TIMEOUT', {
                    message: 'Closing browser due to inactivity',
                    idleTime: `${Math.round(idleTime / 1000)}s`,
                });

                this.closeBrowser('SYSTEM');
            }
        }, 60000);
    }

    /**
     * Gracefully close browser and cleanup
     */
    async closeBrowser(requestId: string): Promise<void> {
        if (this.idleCheckInterval) {
            clearInterval(this.idleCheckInterval);
            this.idleCheckInterval = null;
        }

        if (this.browser) {
            try {
                await this.browser.close();
                logger.info(requestId, 'BROWSER_POOL_CLOSED', {
                    message: 'Browser closed successfully',
                });
            } catch (error) {
                logger.error(requestId, 'BROWSER_POOL_CLOSE_ERROR', error as Error);
            } finally {
                this.browser = null;
            }
        }
    }

    /**
     * Check if browser is healthy and connected
     */
    isHealthy(): boolean {
        return this.browser !== null && this.browser.isConnected();
    }

    /**
     * Get browser pool status for health checks
     */
    getStatus(): {
        healthy: boolean;
        idleTime: number;
        isInitializing: boolean;
    } {
        return {
            healthy: this.isHealthy(),
            idleTime: Date.now() - this.lastUsed,
            isInitializing: this.isInitializing,
        };
    }
}

/**
 * Export singleton instance
 */
export const browserPool = new BrowserPool();
