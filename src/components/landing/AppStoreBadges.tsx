export function AppStoreBadges({
  appStoreUrl,
  playStoreUrl,
}: {
  appStoreUrl?: string | null
  playStoreUrl?: string | null
}) {
  if (!appStoreUrl && !playStoreUrl) return null

  return (
    <div className="mt-4 flex flex-wrap items-center justify-start gap-3 md:justify-center">
      {playStoreUrl && (
        <a
          href={playStoreUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 rounded-lg border border-white/20 bg-white/10 px-4 py-2.5 text-white hover:bg-white/20"
        >
          <svg viewBox="0 0 24 24" className="h-6 w-6 flex-shrink-0" fill="currentColor">
            <path d="M3.6 2.5c-.4.2-.6.6-.6 1.1v17c0 .5.2.9.6 1.1l9.9-9.6L3.6 2.5Z" />
            <path d="M16.4 9.4 5.1 3l9.5 8L16.4 9.4Z" />
            <path d="M16.4 14.6l-1.8-1.6-2 2 3.8 3.1 2.2-1.2-2.2-2.3Z" />
            <path d="M17.7 10.4l-2.1 2.1 2.1 2.1 2.4-1.4c.6-.4.6-1.4 0-1.7l-2.4-1.1Z" />
          </svg>
          <span className="flex flex-col leading-none">
            <span className="text-[10px] opacity-80">Disponível no</span>
            <span className="text-sm font-bold">Google Play</span>
          </span>
        </a>
      )}
      {appStoreUrl && (
        <a
          href={appStoreUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 rounded-lg border border-white/20 bg-white/10 px-4 py-2.5 text-white hover:bg-white/20"
        >
          <svg viewBox="0 0 24 24" className="h-6 w-6 flex-shrink-0" fill="currentColor">
            <path d="M16.4 1.3c.1 1-.3 2-.9 2.7-.6.8-1.7 1.4-2.7 1.3-.1-1 .4-2 .9-2.7.6-.7 1.7-1.3 2.7-1.3ZM19.7 17c-.5 1.1-.7 1.6-1.4 2.6-.9 1.4-2.2 3.1-3.8 3.1-1.4 0-1.8-.9-3.6-.9s-2.3.9-3.6.9c-1.6 0-2.8-1.5-3.7-2.9-2.5-3.9-2.8-8.4-1.2-10.8 1.1-1.7 2.9-2.7 4.5-2.7 1.6 0 2.7 1 4 1 1.3 0 2.1-1 4-1 1.5 0 3 .8 4.1 2.2-3.6 2-3 7.1.7 8.5Z" />
          </svg>
          <span className="flex flex-col leading-none">
            <span className="text-[10px] opacity-80">Baixe na</span>
            <span className="text-sm font-bold">App Store</span>
          </span>
        </a>
      )}
    </div>
  )
}
