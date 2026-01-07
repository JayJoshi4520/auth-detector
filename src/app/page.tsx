'use client';

import { useState, useEffect } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';


// Loading Animation Component
function BrutalLoader() {
    return (
        <div className="flex flex-col items-center gap-8">
            <div className="relative w-24 h-24">
                <div className="absolute inset-0 border-4 border-[#c8ff00] animate-spin"
                    style={{ animationDuration: '3s' }}></div>
                <div className="absolute inset-3 border-4 border-[#ff2281] animate-spin"
                    style={{ animationDuration: '2s', animationDirection: 'reverse' }}></div>
                <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-4 h-4 bg-[#00ffff] animate-pulse"></div>
                </div>
                <div className="absolute -top-1 -left-1 w-3 h-3 bg-[#c8ff00]"></div>
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-[#c8ff00]"></div>
                <div className="absolute -bottom-1 -left-1 w-3 h-3 bg-[#c8ff00]"></div>
                <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-[#c8ff00]"></div>
            </div>

            <div className="w-64 h-2 bg-[#1a1a1a] border-2 border-white overflow-hidden">
                <div className="h-full bg-[#c8ff00] animate-loading-bar"></div>
            </div>
            <div className="text-center space-y-2">
                <div className="text-[#c8ff00] text-lg font-bold uppercase tracking-widest">
                    SCANNING TARGET
                </div>
                <div className="text-white/50 text-sm font-medium tracking-wide animate-pulse">
                    Extracting authentication components...
                </div>
            </div>
        </div>
    );
}


export default function Home() {
    const [url, setUrl] = useState('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<{
        found: boolean;
        html?: string;
        message?: string;
        metadata?: {
            hasTraditional: boolean;
            hasOAuth: boolean;
            brands: string[];
            count: number;
        };
        oauthButtons?: Array<{ brand: string; html: string; text: string }>;
    } | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    const handleAnalyze = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!url) return;

        setLoading(true);
        setResult(null);
        setError(null);

        try {
            const response = await fetch('/api/scrape', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ url }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Something went wrong');
            }

            setResult(data);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    if (!mounted) return null;

    return (
        <main className="min-h-screen bg-[#0a0a0a] text-white flex flex-col items-center justify-start relative overflow-hidden">

            <div className="fixed inset-0 stripe-pattern opacity-30 pointer-events-none"></div>

            <div className="fixed top-0 left-0 w-full h-2 bg-[#c8ff00]"></div>
            <div className="fixed bottom-0 left-0 w-full h-2 bg-[#ff2281]"></div>

            <div className="fixed top-20 left-10 w-16 h-16 border-4 border-[#00ffff] rotate-12 opacity-50"></div>
            <div className="fixed bottom-32 right-16 w-24 h-24 border-4 border-[#c8ff00] -rotate-6 opacity-40"></div>
            <div className="fixed top-1/3 right-8 w-8 h-32 bg-[#ff2281] opacity-20"></div>

            <div className="z-10 w-full max-w-4xl px-6 py-24 flex flex-col items-center space-y-16">

                <div className="text-center space-y-8 animate-slide-up">

                    <h1 className="text-brutal-xl text-white animate-glitch">
                        AUTH<br />
                        <span className="text-[#c8ff00]">DETECTOR</span>
                    </h1>

                    {/* Subtitle */}
                    <p className="text-lg text-white/60 max-w-md mx-auto font-medium">
                        Extract authentication components from any digital interface.
                        <span className="text-[#ff2281] font-bold"> No limits.</span>
                    </p>
                </div>

                <div className="w-full max-w-xl animate-slide-up flex flex-col items-center" style={{ animationDelay: '0.15s' }}>
                    <form onSubmit={handleAnalyze} className="w-full flex flex-col items-center gap-8">
                        <input
                            type="url"
                            placeholder="PASTE TARGET URL..."
                            className="w-3/4 brutal-input px-6 py-5 text-lg font-bold tracking-wide placeholder:text-white/30"
                            style={{ fontFamily: 'inherit' }}
                            value={url}
                            onChange={(e) => setUrl(e.target.value)}
                            required
                        />

                        <button
                            type="submit"
                            disabled={loading}
                            className="brutal-button px-10 py-4 text-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
                        >
                            {loading ? (
                                <>
                                    SCANNING...
                                </>
                            ) : (
                                <>
                                    EXTRACT AUTH →
                                </>
                            )}
                        </button>
                    </form>
                </div>

                {loading && (
                    <div className="w-full brutal-card p-12 animate-slide-up">
                        <BrutalLoader />
                    </div>
                )}

                {error && (
                    <div className="w-full bg-[#111] border-4 border-[#ff2281] p-6 animate-brutal-shake brutal-shadow-pink">
                        <div className="flex items-center gap-3">
                            <span className="text-[#ff2281] text-2xl font-bold">✕</span>
                            <div>
                                <div className="text-[#ff2281] text-sm font-bold uppercase tracking-widest mb-1">ERROR</div>
                                <p className="text-white font-medium">{error}</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Result Area */}
                {result && !loading && (
                    <div className="w-full space-y-8 animate-slide-up" style={{ animationDelay: '0.1s' }}>

                        {/* Status Header */}
                        <div className="flex items-center justify-between border-b-4 border-white pb-4">
                            <h2 className="text-brutal-lg">ANALYSIS RESULT</h2>
                            <div className={`px-8 py-4 font-bold text-sm uppercase tracking-widest ${result.found
                                ? 'bg-[#c8ff00] text-[#000000] border-[3px] border-[#000000]'
                                : 'bg-[#ff2281] text-[#000000] border-[3px] border-[#000000]'
                                }`}
                            >
                                {result.found ? 'FOUND' : 'NOT FOUND'}
                            </div>
                        </div>

                        {!result.found && result.message && (
                            <p className="text-white/60 text-lg font-medium">{result.message}</p>
                        )}

                        {result.found && result.metadata && (
                            <div className="flex flex-wrap gap-4 animate-slide-up">
                                {result.metadata.hasTraditional && (
                                    <div className="px-4 py-2 bg-white/5 border-2 border-white/20 text-xs font-bold uppercase tracking-widest flex items-center gap-2">
                                        <div className="w-2 h-2 bg-[#c8ff00]"></div>
                                        TRADITIONAL FORM
                                    </div>
                                )}
                                {result.metadata.hasOAuth && (
                                    <div className="px-4 py-2 bg-white/5 border-2 border-white/20 text-xs font-bold uppercase tracking-widest flex items-center gap-2">
                                        <div className="w-2 h-2 bg-[#00ffff]"></div>
                                        OAUTH / SSO
                                    </div>
                                )}
                                {result.metadata.brands.map(brand => (
                                    <div key={brand} className="px-4 py-2 bg-[#1a1a1a] border-2 border-[#ff2281] text-[#ff2281] text-xs font-bold uppercase tracking-widest brutal-shadow-pink-sm">
                                        {brand}
                                    </div>
                                ))}
                            </div>
                        )}

                        {result.found && result.html && (
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
                                {/* Source Card */}
                                <div className="brutal-card overflow-hidden flex flex-col h-[500px] animate-slide-in-left">
                                    <div className="px-6 py-4 border-b-3 border-white bg-[#1a1a1a] flex items-center justify-between">
                                        <span className="text-sm font-bold uppercase tracking-widest text-[#c8ff00]">
                                            {'<'} HTML SOURCE {'>'}
                                        </span>
                                        <button
                                            onClick={() => navigator.clipboard.writeText(result.html!)}
                                            className="brutal-button-outline px-4 py-2 text-xs"
                                        >
                                            COPY
                                        </button>
                                    </div>
                                    <div className="flex-1 overflow-auto custom-scrollbar bg-[#1e1e1e]">
                                        <SyntaxHighlighter
                                            language="html"
                                            style={vscDarkPlus}
                                            customStyle={{
                                                margin: 0,
                                                padding: '1.5rem',
                                                background: '#1e1e1e',
                                                fontSize: '0.875rem',
                                            }}
                                            wrapLongLines={true}
                                        >
                                            {result.html}
                                        </SyntaxHighlighter>
                                    </div>
                                </div>

                                {/* Preview Card */}
                                <div className="brutal-card-accent overflow-hidden flex flex-col h-[500px] animate-slide-in-left" style={{ animationDelay: '0.1s' }}>
                                    <div className="px-6 py-4 border-b-3 border-[#c8ff00] bg-[#1a1a1a] flex items-center justify-between">
                                        <span className="text-sm font-bold uppercase tracking-widest text-[#c8ff00]">
                                            ISOLATED PREVIEW
                                        </span>
                                        <div className="flex space-x-2">
                                            <div className="w-4 h-4 bg-[#ff2281]"></div>
                                            <div className="w-4 h-4 bg-[#c8ff00]"></div>
                                            <div className="w-4 h-4 bg-[#00ffff]"></div>
                                        </div>
                                    </div>
                                    <div className="flex-1 relative bg-white">
                                        <div className="absolute inset-0 overflow-auto p-8 flex items-center justify-center text-black">
                                            <div className="w-full max-w-sm" dangerouslySetInnerHTML={{ __html: result.html }} />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

            </div>
        </main>
    );
}
