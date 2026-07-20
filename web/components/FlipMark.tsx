/** Flip logo — the real asset from /public/logos/logo.svg. */
export function FlipMark({ height = 22, className = "" }: { height?: number; className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/logos/logo.svg" alt="Flip" height={height} style={{ height }} className={`w-auto ${className}`} />;
}

export function XIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-label="X">
      <path d="M10.8442 15.1515L4.4085 22.5H0.84375L9.17925 12.978L10.8442 15.1515Z" />
      <path d="M12.7891 8.241L18.6818 1.5H22.2443L14.4391 10.4265L12.7891 8.241Z" />
      <path d="M23.6168 22.5H16.4475L0.384766 1.5H7.73552L23.6168 22.5ZM17.4308 20.3677H19.4048L6.66302 3.5205H4.54502L17.4308 20.3677Z" />
    </svg>
  );
}
