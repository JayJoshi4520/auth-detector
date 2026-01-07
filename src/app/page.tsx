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
                    Extracting authentication components...<br />
                    <p className="text-white/50 text-sm font-medium tracking-wide animate-pulse">Please wait for the scan to complete.
                        <br /> It may not work fully for some websites with strict bot security. (Examples, Stackoverflow, NY Times, etc..)</p>
                </div>
            </div>
        </div>
    );
}


// Accordion Component
function BrutalAccordionItem({ component, index }: { component: any, index: number }) {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <div className="w-full brutal-card overflow-hidden">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full px-6 py-4 flex items-center justify-between bg-[#1a1a1a] hover:bg-[#222] transition-colors"
            >
                <div className="flex items-center gap-4">
                    {component.type === 'traditional' && <div className="w-3 h-3 bg-[#c8ff00] rotate-45"></div>}
                    {component.type === 'oauth' && <div className="w-3 h-3 bg-[#00ffff] rounded-full"></div>}
                    {component.type === 'passwordless' && <div className="w-3 h-3 bg-[#ff2281] skew-x-12"></div>}

                    <span className="text-lg font-bold uppercase tracking-widest text-white">
                        {component.type === 'traditional' ? 'Traditional Auth' :
                            component.type === 'oauth' ? 'OAuth Providers' : 'Passwordless'}
                    </span>
                </div>
                <div className={`transform transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}>
                    <div className="text-[#c8ff00]">▼</div>
                </div>
            </button>

            {isOpen && (
                <div className="p-6 border-t-2 border-white/10 bg-[#111]">
                    <div className="space-y-6">
                        {/* Details */}
                        <div>
                            <div className="text-[#c8ff00] text-xs font-bold uppercase tracking-widest mb-3">DETAILS</div>
                            {component.type === 'oauth' && component.details.providers && (
                                <div className="text-white/80 font-mono text-sm">
                                    <span className="text-white/50">Providers: </span>
                                    {component.details.providers.join(', ')}
                                </div>
                            )}
                            {component.type === 'traditional' && component.details.fields && (
                                <div className="text-white/80 font-mono text-sm">
                                    <span className="text-white/50">Fields: </span>
                                    {component.details.fields.join(', ')}
                                </div>
                            )}
                            {component.type === 'passwordless' && component.details.method && (
                                <div className="text-white/80 font-mono text-sm">
                                    <span className="text-white/50">Method: </span>
                                    {component.details.method}
                                </div>
                            )}
                        </div>

                        {/* Snippet */}
                        {component.snippet && (
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <div className="text-[#c8ff00] text-xs font-bold uppercase tracking-widest">HTML SNIPPET</div>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            navigator.clipboard.writeText(component.snippet);
                                        }}
                                        className="text-[10px] text-white/50 hover:text-white underline decoration-dotted uppercase"
                                    >
                                        Copy Code
                                    </button>
                                </div>
                                <div className="bg-black border border-white/20 p-4 font-mono text-xs text-white/60 overflow-x-auto custom-scrollbar max-h-40">
                                    {component.snippet}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}


export default function Home() {
    const [url, setUrl] = useState('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<{
        success: boolean;
        found: boolean;
        components: Array<{
            type: 'traditional' | 'oauth' | 'passwordless';
            snippet?: string;
            details: {
                fields?: string[];
                providers?: string[];
                method?: string;
            };
        }>;
        detectionMethod: string;
        pageTitle?: string;
        screenshot?: string;
        cached?: boolean;
    } | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    // Combine all snippets for display
    const combinedHtml = result?.components
        .map(c => c.snippet || `<!-- ${c.type} detected -->`)
        .join('\n\n') || '';

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
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'An error occurred');
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

                        <div className="flex flex-wrap items-center justify-center gap-3 mt-8">
                            <span className="text-white/40 text-xs font-bold uppercase tracking-widest w-full text-center mb-2">TRY SAMPLE TARGETS</span>
                            {[
                                { name: 'Vercel', url: 'https://vercel.com/login' },
                                { name: 'LinkedIn', url: 'https://www.linkedin.com/login' },
                                { name: 'Box', url: 'https://account.box.com/login' },
                                { name: 'GitHub', url: 'https://github.com/login' },
                                { name: 'Facebook', url: 'https://www.facebook.com/login' },
                                { name: 'Medium', url: 'https://medium.com/m/signin' },
                            ].map((site) => (
                                <button
                                    key={site.name}
                                    type="button"
                                    onClick={() => setUrl(site.url)}
                                    className="brutal-button px-10 py-4 text-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
                                >
                                    {site.name}
                                </button>
                            ))}
                        </div>
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

                        {!result.found && (
                            <p className="text-white/60 text-lg font-medium">No authentication components detected.</p>
                        )}

                        {result.found && result.components.map((component, idx) => (
                            <div key={idx} className="w-full brutal-card p-8 animate-slide-up" style={{ animationDelay: `${idx * 0.1}s` }}>
                                <div className="flex flex-col gap-6">
                                    {/* Header */}
                                    <div className="flex items-start justify-between">
                                        <div className="flex items-center gap-3">
                                            {component.type === 'traditional' && <div className="p-2 bg-[#c8ff00] text-black"><div className="w-6 h-6 border-2 border-black rotate-45"></div></div>}
                                            {component.type === 'oauth' && <div className="p-2 bg-[#00ffff] text-black"><div className="w-6 h-6 border-2 border-black rounded-full"></div></div>}
                                            {component.type === 'passwordless' && <div className="p-2 bg-[#ff2281] text-black"><div className="w-6 h-6 border-2 border-black skew-x-12"></div></div>}

                                            <div>
                                                <h3 className="text-xl font-bold uppercase tracking-widest text-white">
                                                    {component.type === 'traditional' ? 'TRADITIONAL AUTH' :
                                                        component.type === 'oauth' ? 'OAUTH PROVIDERS' : 'PASSWORDLESS'}
                                                </h3>
                                                <div className="h-1 w-full bg-white/20 mt-1"></div>
                                            </div>
                                        </div>

                                        <div className="px-4 py-1 border border-white/30 text-xs font-mono text-white/50">
                                            DETECTED
                                        </div>
                                    </div>

                                    {/* Details Grid */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                        <div className="space-y-4">
                                            <div className="text-[#c8ff00] text-sm font-bold uppercase tracking-widest mb-2">DETAILS</div>

                                            {component.type === 'oauth' && component.details.providers && (
                                                <div className="flex flex-wrap gap-2">
                                                    {component.details.providers.map(p => (
                                                        <div key={p} className="px-4 py-2 bg-[#1a1a1a] border border-[#00ffff] text-[#00ffff] text-sm font-bold uppercase brutal-shadow-sm">
                                                            {p}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}

                                            {component.type === 'traditional' && component.details.fields && (
                                                <div className="flex flex-wrap gap-2">
                                                    {component.details.fields.map(f => (
                                                        <div key={f} className="px-4 py-2 bg-[#1a1a1a] border border-[#c8ff00] text-[#c8ff00] text-sm font-bold uppercase brutal-shadow-sm">
                                                            {f} FIELD
                                                        </div>
                                                    ))}
                                                </div>
                                            )}

                                            {component.type === 'passwordless' && component.details.method && (
                                                <div className="px-4 py-2 bg-[#1a1a1a] border border-[#ff2281] text-[#ff2281] text-sm font-bold uppercase brutal-shadow-sm inline-block">
                                                    METHOD: {component.details.method}
                                                </div>
                                            )}
                                        </div>

                                        {/* Snippet Preview */}
                                        {component.snippet && (
                                            <div className="space-y-2">
                                                <div className="flex items-center justify-between">
                                                    <div className="text-[#c8ff00] text-sm font-bold uppercase tracking-widest">CODE SNIPPET</div>
                                                    <button
                                                        onClick={() => navigator.clipboard.writeText(component.snippet!)}
                                                        className="text-xs text-white/50 hover:text-white underline decoration-dotted"
                                                    >
                                                        COPY OP
                                                    </button>
                                                </div>
                                                <div className="bg-[#111] border border-white/20 p-4 font-mono text-xs text-white/70 overflow-x-auto custom-scrollbar max-h-40">
                                                    {component.snippet}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}

                        {result.found && combinedHtml && (
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
                                {/* Source Card */}
                                <div className="brutal-card overflow-hidden flex flex-col h-[500px] animate-slide-in-left">
                                    <div className="px-6 py-4 border-b-3 border-white bg-[#1a1a1a] flex items-center justify-between">
                                        <span className="text-sm font-bold uppercase tracking-widest text-[#c8ff00]">
                                            {'<'} HTML SOURCE {'>'}
                                        </span>
                                        <button
                                            onClick={() => navigator.clipboard.writeText(combinedHtml)}
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
                                            {combinedHtml}
                                        </SyntaxHighlighter>
                                    </div>
                                </div>

                                {/* Preview Card */}
                                {/* <div className="brutal-card-accent overflow-hidden flex flex-col h-[500px] animate-slide-in-left" style={{ animationDelay: '0.1s' }}>
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
                                            <div className="w-full max-w-sm" dangerouslySetInnerHTML={{ __html: combinedHtml }} />
                                        </div>
                                    </div>
                                </div> */}
                            </div>
                        )}
                    </div>
                )}

            </div>
        </main>
    );
}
