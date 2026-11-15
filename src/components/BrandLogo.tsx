import React, { useState } from 'react';
import brandLogoImg from '../assets/images/thamanike_brand_logo_1794769486236.jpg';

interface BrandLogoProps {
  size?: 'sm' | 'md';
}

export function BrandLogo({ size = 'md' }: BrandLogoProps) {
  const [imgError, setImgError] = useState(false);

  const imgDimensions = size === 'sm' ? 'w-7 h-7' : 'w-8 h-8';
  const textSize = size === 'sm' ? 'text-lg' : 'text-xl';

  return (
    <span className="inline-flex items-center gap-2.5 whitespace-nowrap shrink-0">
      {!imgError ? (
        <img
          src={brandLogoImg}
          alt="ThamaniKE shield and upward value logo"
          referrerPolicy="no-referrer"
          onError={() => setImgError(true)}
          className={`${imgDimensions} rounded-lg object-cover border border-slate-200 bg-white shrink-0`}
        />
      ) : (
        <span
          className={`${imgDimensions} rounded-lg bg-emerald-700 text-white inline-flex items-center justify-center shrink-0`}
          aria-hidden="true"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="M12 2L4 5v6.09c0 5.05 3.41 9.76 8 10.91 4.59-1.15 8-5.86 8-10.91V5l-8-3z" />
            <path d="M8 14l3-3 2 2 4-4" />
          </svg>
        </span>
      )}
      <span className={`${textSize} font-bold tracking-tight text-slate-900 font-display`}>
        ThamaniKE
      </span>
    </span>
  );
}
