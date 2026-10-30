interface IconProps {
  size?: number;
}

export function XIcon({ size = 16 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

export function RedditIcon({ size = 16 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <ellipse cx="12" cy="14.5" rx="8" ry="5.5" />
      <circle cx="4.3" cy="11.8" r="1.7" />
      <circle cx="19.7" cy="11.8" r="1.7" />
      <path d="M12 9 L13.4 3.8 L17.2 4.8" />
      <circle cx="18.4" cy="5.2" r="1.4" />
      <path d="M9.2 17.2c1.7 1.1 3.9 1.1 5.6 0" />
      <circle cx="9" cy="13.6" r="0.6" fill="currentColor" />
      <circle cx="15" cy="13.6" r="0.6" fill="currentColor" />
    </svg>
  );
}
