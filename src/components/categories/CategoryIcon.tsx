const ICONS: Record<string, { bg: string; fg: string; path: React.ReactNode }> = {
  utensils: {
    bg: '#FDECEA',
    fg: '#D8552C',
    path: (
      <path d="M6 3v7a2 2 0 0 0 4 0V3M8 3v18M18 3c-2 2-2 5-2 7s0 4 2 4 2-2 2-4-.5-6-2-7zM18 14v7" />
    ),
  },
  coffee: {
    bg: '#FDF3E3',
    fg: '#B87A17',
    path: (
      <path d="M4 8h13v6a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V8ZM17 9h1.5a2.5 2.5 0 0 1 0 5H17M7 3c-.6 1 .3 1.5.3 2.5S6.6 7 6 6M11 3c-.6 1 .3 1.5.3 2.5S10.6 7 10 6" />
    ),
  },
  scissors: {
    bg: '#FCE9F1',
    fg: '#C33A6C',
    path: (
      <>
        <circle cx="6" cy="6" r="3" />
        <circle cx="6" cy="18" r="3" />
        <path d="M20 4 8.5 15.5M20 20 8.5 8.5" />
      </>
    ),
  },
  heart: {
    bg: '#EAF6EC',
    fg: '#2E9A48',
    path: <path d="M20.8 4.6a5 5 0 0 0-7.1 0L12 6.3l-1.7-1.7a5 5 0 1 0-7.1 7.1L12 20.4l8.8-8.7a5 5 0 0 0 0-7.1Z" />,
  },
  'shopping-bag': {
    bg: '#E9F1FB',
    fg: '#2870B8',
    path: (
      <>
        <path d="M6 2 3 6v14a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1V6l-3-4Z" />
        <path d="M3 6h18M9 11a3 3 0 0 0 6 0" />
      </>
    ),
  },
  wrench: {
    bg: '#EDEBFB',
    fg: '#5A4FCF',
    path: <path d="M14.7 6.3a3 3 0 1 0-4.2 4.2L4 17v3h3l6.5-6.5a3 3 0 1 0 4.2-4.2l-3-3z" />,
  },
  car: {
    bg: '#FCEAE9',
    fg: '#C6453F',
    path: (
      <path d="M5 17h14M5 17a2 2 0 0 1-2-2v-1a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v1a2 2 0 0 1-2 2M5 12l1.5-5h11L19 12M8 20h1M15 20h1" />
    ),
  },
  home: {
    bg: '#E1F5EE',
    fg: '#0F6E56',
    path: (
      <>
        <path d="M3 11 12 4l9 7" />
        <path d="M5 10v10h14V10" />
      </>
    ),
  },
}

const FALLBACK = {
  bg: '#F1EFE8',
  fg: '#6B7280',
  path: (
    <>
      <circle cx="5" cy="12" r="1.5" />
      <circle cx="12" cy="12" r="1.5" />
      <circle cx="19" cy="12" r="1.5" />
    </>
  ),
}

export function CategoryIcon({ icon, className }: { icon: string; className?: string }) {
  const spec = ICONS[icon] ?? FALLBACK

  return (
    <span
      className={`flex flex-shrink-0 items-center justify-center rounded-xl ${className ?? 'h-9 w-9'}`}
      style={{ background: spec.bg }}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke={spec.fg} strokeWidth={2} className="h-[45%] w-[45%]">
        {spec.path}
      </svg>
    </span>
  )
}
