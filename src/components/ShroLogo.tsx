import React from 'react';

interface ShroLogoProps {
  className?: string;
  variant?: 'color' | 'white';
}

export const ShroLogo: React.FC<ShroLogoProps> = ({ className = 'h-10', variant = 'color' }) => {
  const blueColor = variant === 'white' ? '#FFFFFF' : '#2E5C8C';
  const greenColor = variant === 'white' ? '#86EFAC' : '#208753';

  return (
    <svg
      viewBox="0 0 850 200"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Outer frame */}
      <path
        d="M 165 186 L 8 186 L 8 8 L 336 8 L 336 186 L 298 186"
        stroke={blueColor}
        strokeWidth="10"
        strokeLinecap="square"
      />
      {/* Est. 1988 */}
      <text
        x="172"
        y="193"
        fill={blueColor}
        fontSize="28"
        fontFamily="'Cinzel', Georgia, serif"
        fontWeight="600"
      >
        Est. 1988
      </text>

      {/* SHRO text */}
      <text
        x="28"
        y="142"
        fill={blueColor}
        fontSize="116"
        fontFamily="'Impact', 'Barlow Condensed', sans-serif"
        fontWeight="800"
        letterSpacing="2"
      >
        SHRO
      </text>

      {/* SYSTEMS text */}
      <text
        x="355"
        y="142"
        fill={blueColor}
        fontSize="116"
        fontFamily="'Impact', 'Barlow Condensed', sans-serif"
        fontWeight="800"
        letterSpacing="2"
      >
        SYSTEMS
      </text>

      {/* Tagline */}
      <text
        x="360"
        y="188"
        fill={greenColor}
        fontSize="32"
        fontFamily="'Inter', system-ui, sans-serif"
        fontWeight="600"
      >
        Digital Transformation Specialists
      </text>
    </svg>
  );
};
